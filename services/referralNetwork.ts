import { Contract, formatUnits, getAddress, type AbstractProvider } from 'ethers';
import { CONTRACT_ABI, getContractAddress } from '../constants/contractConfig';
import { DEPLOYED_TESTNET, getKnownStartBlock } from '../constants/deployedAddresses';
import { assertTrustedRpc, getProviderWithFallback, isContractConfigured, NETWORK_CONFIG } from '../constants/rpcConfig';
import { getTokenMeta } from '../constants/tokens';
import { addressToInviteCode } from '../utils/inviteCode';
import { creditDirectWei, sumReferralEarnings } from '../utils/referralEarnings';

const ZERO = '0x0000000000000000000000000000000000000000';
const CHUNK = 2_000;
const RECENT_SPAN = 30_000;
const CHUNK_ATTEMPTS = 4;
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
  registeredBlock: number;
  registeredAt: number;
  lastEarnBlock: number;
  lastEarnAt: number;
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

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LogPack = { events: Awaited<ReturnType<Contract['queryFilter']>>; failed: number };

async function queryFilterChunked(
  contract: Contract,
  filter: unknown,
  fromBlock: number,
  toBlock: number
): Promise<LogPack> {
  if (!filter || fromBlock > toBlock) return { events: [], failed: 0 };
  const ranges: Array<[number, number]> = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    ranges.push([start, Math.min(start + CHUNK - 1, toBlock)]);
  }

  const events: Awaited<ReturnType<Contract['queryFilter']>> = [];
  let failed = 0;
  for (let index = 0; index < ranges.length; index += 1) {
    const [start, end] = ranges[index];
    let got = false;
    for (let attempt = 0; attempt < CHUNK_ATTEMPTS; attempt += 1) {
      try {
        events.push(...await contract.queryFilter(filter as Parameters<Contract['queryFilter']>[0], start, end));
        got = true;
        break;
      } catch {
        if (attempt < CHUNK_ATTEMPTS - 1) await pause(400 * (attempt + 1));
      }
    }
    if (!got) failed += 1;
    else if (index < ranges.length - 1) await pause(120);
  }
  return { events, failed };
}

function mergeLogPacks(packs: LogPack[]): LogPack {
  const seen = new Set<string>();
  const events: LogPack['events'] = [];
  let failed = 0;
  for (const pack of packs) {
    failed += pack.failed;
    for (const event of pack.events) {
      const id = `${event.transactionHash || ''}:${event.index ?? ''}:${event.blockNumber || 0}`;
      if (seen.has(id)) continue;
      seen.add(id);
      events.push(event);
    }
  }
  return { events, failed };
}

/** Los bloques de hoy van primero. Si el tramo viejo falla, el pago reciente se conserva. */
async function queryFilterReliable(
  contract: Contract,
  filter: unknown,
  fromBlock: number,
  toBlock: number
): Promise<LogPack> {
  const recentFrom = Math.max(fromBlock, toBlock - RECENT_SPAN);
  const recent = await queryFilterChunked(contract, filter, recentFrom, toBlock);
  if (fromBlock >= recentFrom) return recent;
  const older = await queryFilterChunked(contract, filter, fromBlock, recentFrom - 1);
  return mergeLogPacks([recent, older]);
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
  const demoContract =
    contractAddress.toLowerCase() === DEPLOYED_TESTNET.contract.toLowerCase();
  const fromConfigured = fromKnown > 0 ? fromKnown : demoContract ? fromEnv : 0;
  const fromLookback = Math.max(0, latest - DEFAULT_LOOKBACK);
  let fromBlock = fromConfigured > 0 ? fromConfigured : fromLookback;
  let truncated = fromConfigured === 0 && fromLookback > 0;
  if (fromBlock > latest) {
    fromBlock = fromLookback;
    truncated = true;
  }
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

const branchCache = new Map<string, ReferralChild[]>();
const snapshotCache = new Map<string, ReferralNetworkSnapshot>();

function snapshotCacheKey(wallet: string): string {
  return `${NETWORK_CONFIG.chainId}:${getContractAddress().toLowerCase()}:${wallet.toLowerCase()}`;
}

export function peekReferralNetwork(walletAddress: string): ReferralNetworkSnapshot | null {
  if (!walletAddress || !isContractConfigured()) return null;
  const self = normalizeAddress(walletAddress);
  if (!self) return null;
  return snapshotCache.get(snapshotCacheKey(self)) || null;
}

export function clearReferralNetworkCache(): void {
  snapshotCache.clear();
}

export function clearReferralBranchCache(): void {
  branchCache.clear();
}

export async function loadReferralChildren(parentAddress: string): Promise<ReferralChild[]> {
  const parent = normalizeAddress(parentAddress);
  if (!parent || !isContractConfigured()) return [];
  const cached = branchCache.get(parent.toLowerCase());
  if (cached) return cached;

  const provider = await assertTrustedRpc(getProviderWithFallback());
  const contractAddress = getContractAddress();
  const contract = new Contract(contractAddress, CONTRACT_ABI, provider);
  const { fromBlock, toBlock } = await resolveStartBlock(provider, contractAddress);
  const pack = await queryFilterChunked(
    contract,
    eventFilter(contract, 'AfiliadoRegistrado', null, parent),
    fromBlock,
    toBlock
  );
  const seen = new Set<string>();
  const people: ReferralChild[] = [];
  for (const event of pack.events) {
    const args = eventArgs(event);
    const usuario = normalizeAddress(asText(argValue(args, 'usuario', 0)));
    const key = usuario.toLowerCase();
    if (!usuario || key === parent.toLowerCase() || seen.has(key)) continue;
    seen.add(key);
    people.push({ address: usuario, code: addressToInviteCode(usuario), level: 1 });
  }
  const levels = await Promise.all(
    people.map(async (person) => {
      try {
        const progress = await contract.obtenerProgresoUsuario(person.address);
        return Math.min(100, Math.max(1, Number(progress.nivelActual ?? progress[0] ?? 1) || 1));
      } catch {
        return 1;
      }
    })
  );
  const next = people.map((person, index) => ({ ...person, level: levels[index] || 1 }));
  if (pack.failed === 0 || next.length > 0) {
    branchCache.set(parent.toLowerCase(), next);
  }
  return next;
}

export async function fillReferralTimestamps(
  nodes: ReferralNode[]
): Promise<Map<string, { registeredAt: number; lastEarnAt: number }>> {
  const out = new Map<string, { registeredAt: number; lastEarnAt: number }>();
  const list = Array.isArray(nodes) ? nodes : [];
  const blocks = list.flatMap((node) => [node.registeredBlock, node.lastEarnBlock].filter((block) => block > 0));
  if (!blocks.length) {
    for (const node of list) {
      out.set(node.address.toLowerCase(), {
        registeredAt: node.registeredAt || 0,
        lastEarnAt: node.lastEarnAt || 0,
      });
    }
    return out;
  }
  try {
    const provider = await assertTrustedRpc(getProviderWithFallback());
    const stamps = await resolveTimestamps(provider, blocks);
    for (const node of list) {
      out.set(node.address.toLowerCase(), {
        registeredAt: stamps.get(node.registeredBlock) || node.registeredAt || 0,
        lastEarnAt: stamps.get(node.lastEarnBlock) || node.lastEarnAt || 0,
      });
    }
    return out;
  } catch {
    for (const node of list) {
      out.set(node.address.toLowerCase(), { registeredAt: 0, lastEarnAt: 0 });
    }
    return out;
  }
}

export async function loadReferralNetwork(walletAddress: string): Promise<ReferralNetworkSnapshot> {
  if (!walletAddress || !isContractConfigured()) return EMPTY;

  const self = normalizeAddress(walletAddress);
  if (!self) return EMPTY;

  const provider = await assertTrustedRpc(getProviderWithFallback());
  const contractAddress = getContractAddress();
  const contract = new Contract(contractAddress, CONTRACT_ABI, provider);
  const { fromBlock, toBlock, partial: lookbackPartial } = await resolveStartBlock(provider, contractAddress);
  clearReferralBranchCache();

  const signupFilter = eventFilter(contract, 'AfiliadoRegistrado', null, self);
  const bonusFilter = eventFilter(contract, 'BonoActivacionPagado', self);
  const commissionFilter = eventFilter(contract, 'ComisionGeneracional', self);

  const signupPack = await queryFilterReliable(contract, signupFilter, fromBlock, toBlock);
  const bonusPack = await queryFilterReliable(contract, bonusFilter, fromBlock, toBlock);
  const commissionPack = await queryFilterReliable(contract, commissionFilter, fromBlock, toBlock);
  const signups = signupPack.events;
  const bonuses = bonusPack.events;
  const commissions = commissionPack.events;

  const directSet = new Set<string>();
  const nodes = new Map<string, ReferralNode>();

  const blankDirect = (usuario: string, registeredBlock: number): ReferralNode => ({
    address: usuario,
    code: addressToInviteCode(usuario),
    earnedWei: '0',
    earnedLabel: formatToken(0n),
    bonusWei: '0',
    bonusLabel: formatToken(0n),
    commissionWei: '0',
    commissionLabel: formatToken(0n),
    level: 1,
    registeredBlock,
    registeredAt: 0,
    lastEarnBlock: 0,
    lastEarnAt: 0,
    children: [],
  });

  const ensureDirect = (address: string, registeredBlock: number): ReferralNode | null => {
    const usuario = normalizeAddress(address);
    if (!usuario || usuario.toLowerCase() === self.toLowerCase()) return null;
    const key = usuario.toLowerCase();
    directSet.add(key);
    const existing = nodes.get(key);
    if (existing) {
      if (registeredBlock > 0 && (!existing.registeredBlock || registeredBlock < existing.registeredBlock)) {
        existing.registeredBlock = registeredBlock;
      }
      return existing;
    }
    const created = blankDirect(usuario, registeredBlock);
    nodes.set(key, created);
    return created;
  };

  for (const event of signups) {
    const args = eventArgs(event);
    ensureDirect(asText(argValue(args, 'usuario', 0)), event.blockNumber || 0);
  }

  const failed = signupPack.failed + bonusPack.failed + commissionPack.failed;

  const parentCache = new Map<string, string>();
  parentCache.set(self.toLowerCase(), ZERO);

  const addEarned = (
    address: string,
    amount: bigint,
    kind: 'bonus' | 'commission',
    blockNumber: number,
    createIfMissing = false,
  ) => {
    const node = createIfMissing
      ? ensureDirect(address, 0)
      : nodes.get(address.toLowerCase());
    if (!node || amount <= 0n) return;
    const next = creditDirectWei(node.earnedWei, node.bonusWei, node.commissionWei, amount, kind);
    node.earnedWei = next.earnedWei;
    node.earnedLabel = formatToken(BigInt(next.earnedWei));
    node.bonusWei = next.bonusWei;
    node.bonusLabel = formatToken(BigInt(next.bonusWei));
    node.commissionWei = next.commissionWei;
    node.commissionLabel = formatToken(BigInt(next.commissionWei));
    if (blockNumber > node.lastEarnBlock) node.lastEarnBlock = blockNumber;
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
    if (referido) addEarned(referido, amount, 'bonus', event.blockNumber || 0, true);
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
      if (owner) addEarned(owner, amount, 'commission', event.blockNumber || 0);
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

  const directs = [...nodes.values()].sort((a, b) => {
    const byBlock = (b.registeredBlock || 0) - (a.registeredBlock || 0);
    if (byBlock) return byBlock;
    const byEarn = BigInt(b.earnedWei) - BigInt(a.earnedWei);
    if (byEarn > 0n) return 1;
    if (byEarn < 0n) return -1;
    return 0;
  });
  const totals = sumReferralEarnings(directs);

  const levelTargets = directs.map((node) => node.address);
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
  }

  const snapshot: ReferralNetworkSnapshot = {
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
  const cacheKey = snapshotCacheKey(self);
  const previous = snapshotCache.get(cacheKey);
  const emptyFail = failed > 0 && directs.length === 0;
  if (emptyFail && previous && previous.directs.length > 0) {
    return { ...previous, partial: true };
  }
  if (!emptyFail) snapshotCache.set(cacheKey, snapshot);
  return snapshot;
}
