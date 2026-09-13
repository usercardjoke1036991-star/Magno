import { Contract, formatUnits, getAddress, type AbstractProvider } from 'ethers';
import { CONTRACT_ABI, getContractAddress } from '../constants/contractConfig';
import { getKnownStartBlock } from '../constants/deployedAddresses';
import { assertTrustedRpc, getProviderWithFallback, isContractConfigured } from '../constants/rpcConfig';
import { getTokenMeta } from '../constants/tokens';
import { addressToInviteCode } from '../utils/inviteCode';
import { sumReferralEarnings } from '../utils/referralEarnings';

const ZERO = '0x0000000000000000000000000000000000000000';
const CHUNK = 4000;
const CHUNK_CONCURRENCY = 3;
const DEFAULT_LOOKBACK = 80_000;
const MAX_SCAN_SPAN = 120_000; // RPC públicos no aguantan el rango completo desde el deploy.

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
  bonusLabel: string;
  commissionWei: string;
  commissionLabel: string;
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
  commissionTotalWei: string;
  commissionTotalLabel: string;
  bonusTotalWei: string;
  bonusTotalLabel: string;
  activity: ReferralActivity[];
  partial: boolean;
}

const EMPTY: ReferralNetworkSnapshot = {
  directs: [],
  totalEarnedWei: '0',
  totalEarnedLabel: '0.00 USDT',
  commissionTotalWei: '0',
  commissionTotalLabel: '0.00 USDT',
  bonusTotalWei: '0',
  bonusTotalLabel: '0.00 USDT',
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

function eventFilter(contract: Contract, name: string, ...params: unknown[]) {
  const factory = (contract.filters as Record<string, unknown>)[name];
  if (typeof factory !== 'function') return null;
  return (factory as (...args: unknown[]) => unknown)(...params);
}

async function queryFilterChunked(
  contract: Contract,
  filter: unknown,
  fromBlock: number,
  toBlock: number
): Promise<{ events: Awaited<ReturnType<Contract['queryFilter']>>; failed: number }> {
  if (!filter) return { events: [], failed: 0 };
  const ranges: Array<[number, number]> = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    ranges.push([start, Math.min(start + CHUNK - 1, toBlock)]);
  }

  const events: Awaited<ReturnType<Contract['queryFilter']>> = [];
  let failed = 0;
  for (let i = 0; i < ranges.length; i += CHUNK_CONCURRENCY) {
    const batch = ranges.slice(i, i + CHUNK_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async ([start, end]) => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            return await contract.queryFilter(filter as Parameters<Contract['queryFilter']>[0], start, end);
          } catch {
            if (attempt === 0) {
              await new Promise((resolve) => setTimeout(resolve, 250));
              continue;
            }
            failed += 1;
            return [];
          }
        }
        return [];
      })
    );
    for (const chunk of results) events.push(...chunk);
  }
  return { events, failed };
}

async function resolveStartBlock(provider: AbstractProvider, contractAddress: string): Promise<{
  fromBlock: number;
  toBlock: number;
  partial: boolean;
}> {
  const latest = await provider.getBlockNumber();
  const configured = Number(process.env.EXPO_PUBLIC_CONTRACT_START_BLOCK || 0);
  const fromEnv = Number.isFinite(configured) && configured > 0 ? configured : 0;
  const fromKnown = getKnownStartBlock(contractAddress);
  const fromConfigured = fromEnv > 0 ? fromEnv : fromKnown;
  const fromLookback = Math.max(0, latest - DEFAULT_LOOKBACK);
  let fromBlock = fromConfigured > 0 ? fromConfigured : fromLookback;
  let truncated = fromConfigured === 0 && fromLookback > 0;
  if (latest - fromBlock > MAX_SCAN_SPAN) {
    fromBlock = Math.max(0, latest - MAX_SCAN_SPAN);
    truncated = true;
  }
  return {
    fromBlock,
    toBlock: latest,
    partial: truncated,
  };
}

async function resolveTimestamps(
  provider: AbstractProvider,
  blockNumbers: number[]
): Promise<Map<number, number>> {
  const unique = [...new Set(blockNumbers.filter((block) => Number.isFinite(block) && block > 0))];
  const stamps = new Map<number, number>();
  const CONCURRENCY = 6;
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const blocks = await Promise.all(
      batch.map(async (blockNumber) => {
        try {
          const block = await provider.getBlock(blockNumber);
          return [blockNumber, Number(block?.timestamp || 0)] as const;
        } catch {
          return [blockNumber, 0] as const;
        }
      })
    );
    for (const [blockNumber, timestamp] of blocks) stamps.set(blockNumber, timestamp);
  }
  return stamps;
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
  const contractAddress = getContractAddress();
  const contract = new Contract(contractAddress, CONTRACT_ABI, provider);
  const { fromBlock, toBlock, partial: lookbackPartial } = await resolveStartBlock(provider, contractAddress);

  const signupFilter = eventFilter(contract, 'AfiliadoRegistrado', null, self);
  const bonusFilter = eventFilter(contract, 'BonoActivacionPagado', self);
  const commissionFilter = eventFilter(contract, 'ComisionGeneracional', self);

  const [signupPack, bonusPack, commissionPack] = await Promise.all([
    queryFilterChunked(contract, signupFilter, fromBlock, toBlock),
    queryFilterChunked(contract, bonusFilter, fromBlock, toBlock),
    queryFilterChunked(contract, commissionFilter, fromBlock, toBlock),
  ]);
  const signups = signupPack.events;
  const bonuses = bonusPack.events;
  const commissions = commissionPack.events;

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
        bonusLabel: formatToken(0n),
        commissionWei: '0',
        commissionLabel: formatToken(0n),
        level: 1,
        children: [],
      });
    }
  }

  const childResults = await Promise.all(
    [...nodes.values()].map(async (node) => {
      const pack = await queryFilterChunked(
        contract,
        eventFilter(contract, 'AfiliadoRegistrado', null, node.address),
        fromBlock,
        toBlock
      );
      return { node, pack };
    })
  );
  let failed = signupPack.failed + bonusPack.failed + commissionPack.failed;
  for (const { node, pack } of childResults) {
    failed += pack.failed;
    node.children = pack.events
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
    if (kind === 'bonus') {
      const nextBonus = BigInt(node.bonusWei) + amount;
      node.bonusWei = nextBonus.toString();
      node.bonusLabel = formatToken(nextBonus);
    } else {
      const nextCommission = BigInt(node.commissionWei) + amount;
      node.commissionWei = nextCommission.toString();
      node.commissionLabel = formatToken(nextCommission);
    }
  };

  const drafts: Array<ReferralActivity & { blockNumber: number }> = [];

  for (const event of signups) {
    const args = eventArgs(event);
    const usuario = normalizeAddress(asText(argValue(args, 'usuario', 0)));
    if (!usuario) continue;
    drafts.push({
      id: `${event.transactionHash}-signup`,
      type: 'signup',
      titleKey: 'activitySignup',
      code: addressToInviteCode(usuario),
      timestamp: 0,
      blockNumber: event.blockNumber,
    });
  }

  for (const event of bonuses) {
    const args = eventArgs(event);
    const referido = normalizeAddress(asText(argValue(args, 'referido', 1)));
    const amount = asBigInt(argValue(args, 'monto', 2));
    const token = asText(argValue(args, 'token', 3));
    if (referido) addEarned(referido, amount, 'bonus');
    drafts.push({
      id: `${event.transactionHash}-bonus`,
      type: 'bonus',
      titleKey: 'activityBonus',
      code: referido ? addressToInviteCode(referido) : '',
      amountLabel: formatToken(amount, token),
      timestamp: 0,
      blockNumber: event.blockNumber,
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
    drafts.push({
      id: `${event.transactionHash}-commission-${generation}`,
      type: 'commission',
      titleKey: 'activityCommission',
      code: deudor ? addressToInviteCode(deudor) : '',
      amountLabel: formatToken(amount, token),
      generation,
      timestamp: 0,
      blockNumber: event.blockNumber,
    });
  }

  drafts.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
  const recent = drafts.slice(0, 30);
  const stamps = await resolveTimestamps(provider, recent.map((item) => item.blockNumber));
  const activity: ReferralActivity[] = recent.map(({ blockNumber, ...item }) => ({
    ...item,
    timestamp: stamps.get(blockNumber) || 0,
  }));

  const directs = [...nodes.values()].sort((a, b) => Number(BigInt(b.earnedWei) - BigInt(a.earnedWei)));
  const totals = sumReferralEarnings(directs);

  const levelTargets = [
    ...directs.map((node) => node.address),
    ...directs.flatMap((node) => node.children.map((child) => child.address)),
  ];
  const uniqueLevels = [...new Set(levelTargets.map((item) => item.toLowerCase()))];
  const levelEntries = await Promise.all(
    uniqueLevels.map(async (address) => {
      try {
        const progress = await contract.obtenerProgresoUsuario(address);
        const level = Math.min(100, Math.max(1, Number(progress.nivelActual ?? progress[0] ?? 1) || 1));
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
    totalEarnedWei: totals.totalWei.toString(),
    totalEarnedLabel: formatToken(totals.totalWei),
    commissionTotalWei: totals.commissionWei.toString(),
    commissionTotalLabel: formatToken(totals.commissionWei),
    bonusTotalWei: totals.bonusWei.toString(),
    bonusTotalLabel: formatToken(totals.bonusWei),
    activity,
    partial: lookbackPartial || failed > 0,
  };
}
