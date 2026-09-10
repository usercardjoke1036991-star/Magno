import { Contract, formatUnits, getAddress, type AbstractProvider } from 'ethers';
import { CONTRACT_ABI, getContractAddress } from '../constants/contractConfig';
import { assertTrustedRpc, getProviderWithFallback, isContractConfigured } from '../constants/rpcConfig';
import { getTokenMeta } from '../constants/tokens';
import { addressToInviteCode } from '../utils/inviteCode';

const ZERO = '0x0000000000000000000000000000000000000000';
const CHUNK = 4000;
const DEFAULT_LOOKBACK = 80_000;

export interface ReferralChild {
  address: string;
  code: string;
  level: number;
}

export interface ReferralNode {
  address: string;
  code: string;
  earnedWei: string;
  earnedLabel: string;
  bonusWei: string;
  commissionWei: string;
  level: number;
  children: ReferralChild[];
}

export interface ReferralActivity {
  id: string;
  type: 'signup' | 'commission' | 'bonus';
  titleKey: 'activitySignup' | 'activityCommission' | 'activityBonus';
  code: string;
  amountLabel?: string;
  generation?: number;
  timestamp: number;
}

export interface ReferralNetworkSnapshot {
  directs: ReferralNode[];
  totalEarnedWei: string;
  totalEarnedLabel: string;
  activity: ReferralActivity[];
  partial: boolean;
}

const EMPTY: ReferralNetworkSnapshot = {
  directs: [],
  totalEarnedWei: '0',
  totalEarnedLabel: '0.00 USDT',
  activity: [],
  partial: false,
};

function normalizeAddress(value: string): string {
  try {
    return getAddress(value);
  } catch {
    return '';
  }
}

function eventArgs(event: object): Record<string, unknown> {
  const args = 'args' in event ? (event as { args?: unknown }).args : undefined;
  if (!args || typeof args !== 'object') return {};
  return args as Record<string, unknown>;
}

function argValue(args: Record<string, unknown>, name: string, index: number): unknown {
  if (args[name] !== undefined) return args[name];
  return (args as unknown as unknown[])[index];
}

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string' && value !== '') return BigInt(value);
  return 0n;
}

function asText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function formatToken(amount: bigint, token?: string): string {
  const meta = token ? getTokenMeta(token) : undefined;
  const decimals = meta?.decimals ?? 18;
  const symbol = meta?.symbol ?? 'USDT';
  return `${Number(formatUnits(amount, decimals)).toFixed(4)} ${symbol}`;
}

async function queryFilterChunked(
  contract: Contract,
  filter: unknown,
  fromBlock: number,
  toBlock: number
) {
  const events = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, toBlock);
    try {
      const chunk = await contract.queryFilter(filter as Parameters<Contract['queryFilter']>[0], start, end);
      events.push(...chunk);
    } catch {
      // RPC públicos limitan el rango; se continúa con el resto.
    }
  }
  return events;
}

async function resolveStartBlock(provider: AbstractProvider): Promise<{
  fromBlock: number;
  toBlock: number;
  partial: boolean;
}> {
  const latest = await provider.getBlockNumber();
  const configured = Number(process.env.EXPO_PUBLIC_CONTRACT_START_BLOCK || 0);
  const fromConfigured = Number.isFinite(configured) && configured > 0 ? configured : 0;
  const fromLookback = Math.max(0, latest - DEFAULT_LOOKBACK);
  const fromBlock = fromConfigured > 0 ? fromConfigured : fromLookback;
  return {
    fromBlock,
    toBlock: latest,
    partial: fromConfigured === 0 && fromLookback > 0,
  };
}

async function parentOf(
  contract: Contract,
  wallet: string,
  cache: Map<string, string>
): Promise<string> {
  const key = wallet.toLowerCase();
  if (cache.has(key)) return cache.get(key) || '';
  try {
    const node = await contract.redGenealogica(wallet);
    const padre = normalizeAddress(String(node.padre ?? node[0] ?? ''));
    cache.set(key, padre);
    return padre;
  } catch {
    cache.set(key, '');
    return '';
  }
}

async function nearestDirect(
  contract: Contract,
  source: string,
  self: string,
  directs: Set<string>,
  cache: Map<string, string>
): Promise<string> {
  let cursor = normalizeAddress(source);
  const seen = new Set<string>();
  for (let i = 0; i < 8 && cursor && !seen.has(cursor.toLowerCase()); i += 1) {
    if (directs.has(cursor.toLowerCase())) return cursor;
    seen.add(cursor.toLowerCase());
    const next = await parentOf(contract, cursor, cache);
    if (!next || next.toLowerCase() === self.toLowerCase() || next === ZERO) break;
    cursor = next;
  }
  return '';
}

export async function loadReferralNetwork(walletAddress: string): Promise<ReferralNetworkSnapshot> {
  if (!walletAddress || !isContractConfigured()) return EMPTY;

  const self = normalizeAddress(walletAddress);
  if (!self) return EMPTY;

  const provider = await assertTrustedRpc(getProviderWithFallback());
  const contract = new Contract(getContractAddress(), CONTRACT_ABI, provider);
  const { fromBlock, toBlock, partial } = await resolveStartBlock(provider);

  const [signups, bonuses, commissions] = await Promise.all([
    queryFilterChunked(contract, contract.filters.AfiliadoRegistrado(null, self), fromBlock, toBlock),
    queryFilterChunked(contract, contract.filters.BonoActivacionPagado(self), fromBlock, toBlock),
    queryFilterChunked(contract, contract.filters.ComisionGeneracional(self), fromBlock, toBlock),
  ]);

  const directSet = new Set<string>();
  const nodes = new Map<string, ReferralNode>();

  for (const event of signups) {
    const args = eventArgs(event);
    const usuario = normalizeAddress(asText(argValue(args, 'usuario', 0)));
    if (!usuario || usuario.toLowerCase() === self.toLowerCase()) continue;
    const key = usuario.toLowerCase();
    directSet.add(key);
    if (!nodes.has(key)) {
      nodes.set(key, {
        address: usuario,
        code: addressToInviteCode(usuario),
        earnedWei: '0',
        earnedLabel: formatToken(0n),
        bonusWei: '0',
        commissionWei: '0',
        level: 1,
        children: [],
      });
    }
  }

  const childQueries = [...nodes.values()].map((node) =>
    queryFilterChunked(contract, contract.filters.AfiliadoRegistrado(null, node.address), fromBlock, toBlock)
      .then((events) => ({ node, events }))
  );
  const childResults = await Promise.all(childQueries);
  for (const { node, events } of childResults) {
    node.children = events
      .map((event) => {
        const args = eventArgs(event);
        const usuario = normalizeAddress(asText(argValue(args, 'usuario', 0)));
        return usuario
          ? { address: usuario, code: addressToInviteCode(usuario), level: 1 }
          : null;
      })
      .filter((item): item is ReferralChild => Boolean(item));
  }

  const parentCache = new Map<string, string>();
  parentCache.set(self.toLowerCase(), ZERO);

  const addEarned = (address: string, amount: bigint, kind: 'bonus' | 'commission') => {
    const key = address.toLowerCase();
    const node = nodes.get(key);
    if (!node) return;
    const next = BigInt(node.earnedWei) + amount;
    node.earnedWei = next.toString();
    node.earnedLabel = formatToken(next);
    if (kind === 'bonus') node.bonusWei = (BigInt(node.bonusWei) + amount).toString();
    else node.commissionWei = (BigInt(node.commissionWei) + amount).toString();
  };

  const activity: ReferralActivity[] = [];

  for (const event of signups) {
    const args = eventArgs(event);
    const usuario = normalizeAddress(asText(argValue(args, 'usuario', 0)));
    if (!usuario) continue;
    activity.push({
      id: `${event.transactionHash}-signup`,
      type: 'signup',
      titleKey: 'activitySignup',
      code: addressToInviteCode(usuario),
      timestamp: 0,
    });
  }

  for (const event of bonuses) {
    const args = eventArgs(event);
    const referido = normalizeAddress(asText(argValue(args, 'referido', 1)));
    const amount = asBigInt(argValue(args, 'monto', 2));
    const token = asText(argValue(args, 'token', 3));
    if (referido) addEarned(referido, amount, 'bonus');
    activity.push({
      id: `${event.transactionHash}-bonus`,
      type: 'bonus',
      titleKey: 'activityBonus',
      code: referido ? addressToInviteCode(referido) : '',
      amountLabel: formatToken(amount, token),
      timestamp: 0,
    });
  }

  for (const event of commissions) {
    const args = eventArgs(event);
    const deudor = normalizeAddress(asText(argValue(args, 'deudor', 1)));
    const generation = Number(argValue(args, 'generacion', 2) ?? 0);
    const amount = asBigInt(argValue(args, 'monto', 3));
    const token = asText(argValue(args, 'token', 4));
    if (deudor) {
      const owner = directSet.has(deudor.toLowerCase())
        ? deudor
        : await nearestDirect(contract, deudor, self, directSet, parentCache);
      if (owner) addEarned(owner, amount, 'commission');
    }
    activity.push({
      id: `${event.transactionHash}-commission-${generation}`,
      type: 'commission',
      titleKey: 'activityCommission',
      code: deudor ? addressToInviteCode(deudor) : '',
      amountLabel: formatToken(amount, token),
      generation,
      timestamp: 0,
    });
  }

  const directs = [...nodes.values()].sort((a, b) => Number(BigInt(b.earnedWei) - BigInt(a.earnedWei)));
  const total = directs.reduce((sum, node) => sum + BigInt(node.earnedWei), 0n);

  const levelTargets = [
    ...directs.map((node) => node.address),
    ...directs.flatMap((node) => node.children.map((child) => child.address)),
  ];
  const uniqueLevels = [...new Set(levelTargets.map((item) => item.toLowerCase()))];
  const levelEntries = await Promise.all(
    uniqueLevels.map(async (address) => {
      try {
        const progress = await contract.obtenerProgresoUsuario(address);
        const level = Math.min(10, Math.max(1, Number(progress.nivelActual ?? progress[0] ?? 1) || 1));
        return [address, level] as const;
      } catch {
        return [address, 1] as const;
      }
    })
  );
  const levels = new Map(levelEntries);
  for (const node of directs) {
    node.level = levels.get(node.address.toLowerCase()) || 1;
    node.children = node.children.map((child) => ({
      ...child,
      level: levels.get(child.address.toLowerCase()) || 1,
    }));
  }

  return {
    directs,
    totalEarnedWei: total.toString(),
    totalEarnedLabel: formatToken(total),
    activity: activity.slice(-30).reverse(),
    partial,
  };
}
