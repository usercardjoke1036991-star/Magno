import { Contract, formatUnits, getAddress, type AbstractProvider } from 'ethers';
import { CONTRACT_ABI, getContractAddress } from '../constants/contractConfig';
import { getKnownStartBlock } from '../constants/deployedAddresses';
import { assertTrustedRpc, getProviderWithFallback, isContractConfigured } from '../constants/rpcConfig';
import { attachCombinedScores, type FamePlayer } from '../utils/fameRankings';

const CHUNK = 4000;
const CHUNK_CONCURRENCY = 3;
const DEFAULT_LOOKBACK = 80_000;
const MAX_SCAN_SPAN = 120_000;
/** Con bloque de deploy conocido se recorre más historia; el RPC sigue yendo a trozos. */
const KNOWN_SCAN_SPAN = 400_000;
const VIEW_BATCH = 8;
const MAX_PLAYERS = 400;
const ZERO = '0x0000000000000000000000000000000000000000';

export interface FameLeaderboardSnapshot {
  players: FamePlayer[];
  partial: boolean;
}

const cache = new Map<string, FameLeaderboardSnapshot>();

const EMPTY: FameLeaderboardSnapshot = { players: [], partial: false };

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
  const fromKnown = getKnownStartBlock(contractAddress);
  const fromLookback = Math.max(0, latest - DEFAULT_LOOKBACK);
  let fromBlock = fromKnown > 0 ? fromKnown : fromLookback;
  let truncated = fromKnown === 0 && fromLookback > 0;
  const maxSpan = fromKnown > 0 ? KNOWN_SCAN_SPAN : MAX_SCAN_SPAN;
  if (latest - fromBlock > maxSpan) {
    fromBlock = Math.max(0, latest - maxSpan);
    truncated = true;
  }
  return { fromBlock, toBlock: latest, partial: truncated };
}

function cacheKey(): string {
  return `${getContractAddress().toLowerCase()}`;
}

export function peekFameLeaderboard(): FameLeaderboardSnapshot | null {
  if (!isContractConfigured()) return EMPTY;
  return cache.get(cacheKey()) || null;
}

export function clearFameLeaderboardCache(): void {
  cache.clear();
}

function takeRoster(order: string[], viewer: string): { roster: string[]; truncated: boolean } {
  const truncated = order.length > MAX_PLAYERS;
  let roster = order.slice(0, MAX_PLAYERS);
  if (!viewer) return { roster, truncated };
  const viewerKey = viewer.toLowerCase();
  if (roster.some((address) => address.toLowerCase() === viewerKey)) {
    return { roster, truncated };
  }
  roster = roster.length < MAX_PLAYERS ? [...roster, viewer] : [...roster.slice(0, MAX_PLAYERS - 1), viewer];
  return { roster, truncated };
}

export async function loadFameLeaderboard(viewerAddress = ''): Promise<FameLeaderboardSnapshot> {
  if (!isContractConfigured()) return EMPTY;
  const key = cacheKey();
  const provider = await assertTrustedRpc(getProviderWithFallback());
  const contractAddress = getContractAddress();
  const contract = new Contract(contractAddress, CONTRACT_ABI, provider);
  const range = await resolveStartBlock(provider, contractAddress);
  const viewer = normalizeAddress(viewerAddress);

  const [signups, issued, paid, bonuses] = await Promise.all([
    queryFilterChunked(contract, eventFilter(contract, 'AfiliadoRegistrado'), range.fromBlock, range.toBlock),
    queryFilterChunked(contract, eventFilter(contract, 'PrestamoEmitido'), range.fromBlock, range.toBlock),
    queryFilterChunked(contract, eventFilter(contract, 'PrestamoPagado'), range.fromBlock, range.toBlock),
    queryFilterChunked(contract, eventFilter(contract, 'BonoHitoPagado'), range.fromBlock, range.toBlock),
  ]);

  const order: string[] = [];
  const seen = new Set<string>();
  const referrals = new Map<string, number>();
  const remember = (address: string) => {
    const keyAddr = address.toLowerCase();
    if (!keyAddr || seen.has(keyAddr) || address === ZERO) return;
    seen.add(keyAddr);
    order.push(address);
  };

  const signupEvents = [...signups.events].sort((left, right) => {
    const block = (left.blockNumber || 0) - (right.blockNumber || 0);
    if (block !== 0) return block;
    return (left.index || 0) - (right.index || 0);
  });
  for (const event of signupEvents) {
    const args = eventArgs(event);
    const usuario = normalizeAddress(asText(argValue(args, 'usuario', 0)));
    const padre = normalizeAddress(asText(argValue(args, 'padre', 1)));
    if (!usuario) continue;
    remember(usuario);
    if (padre && padre !== ZERO && padre.toLowerCase() !== usuario.toLowerCase()) {
      remember(padre);
      referrals.set(padre.toLowerCase(), (referrals.get(padre.toLowerCase()) || 0) + 1);
    }
  }

  const requested = new Map<string, number>();
  for (const event of issued.events) {
    const usuario = normalizeAddress(asText(argValue(eventArgs(event), 'usuario', 0)));
    if (!usuario) continue;
    remember(usuario);
    requested.set(usuario.toLowerCase(), (requested.get(usuario.toLowerCase()) || 0) + 1);
  }

  const paidCount = new Map<string, number>();
  const paidWei = new Map<string, bigint>();
  for (const event of paid.events) {
    const args = eventArgs(event);
    const usuario = normalizeAddress(asText(argValue(args, 'usuario', 0)));
    if (!usuario) continue;
    remember(usuario);
    const keyAddr = usuario.toLowerCase();
    paidCount.set(keyAddr, (paidCount.get(keyAddr) || 0) + 1);
    paidWei.set(keyAddr, (paidWei.get(keyAddr) || 0n) + asBigInt(argValue(args, 'montoPrincipal', 1)));
  }

  const bonusCount = new Map<string, number>();
  const bonusWei = new Map<string, bigint>();
  for (const event of bonuses.events) {
    const args = eventArgs(event);
    const usuario = normalizeAddress(asText(argValue(args, 'usuario', 0)));
    if (!usuario) continue;
    remember(usuario);
    const keyAddr = usuario.toLowerCase();
    bonusCount.set(keyAddr, (bonusCount.get(keyAddr) || 0) + 1);
    bonusWei.set(keyAddr, (bonusWei.get(keyAddr) || 0n) + asBigInt(argValue(args, 'monto', 2)));
  }

  if (viewer) remember(viewer);
  const { roster, truncated: rosterTruncated } = takeRoster(order, viewer);
  const fame = new Map<string, number>();
  const closed = new Map<string, number>();
  const levels = new Map<string, number>();
  const mora = new Map<string, boolean>();
  for (let i = 0; i < roster.length; i += VIEW_BATCH) {
    const batch = roster.slice(i, i + VIEW_BATCH);
    const rows = await Promise.all(
      batch.map(async (address) => {
        try {
          const [history, closedLoans, progress, delinquent] = await Promise.all([
            contract.obtenerHistorialUsuario(address),
            contract.prestamosCerrados(address),
            contract.obtenerProgresoUsuario(address),
            contract.esMoroso(address).catch(() => false),
          ]);
          return {
            address,
            fame: Number(history.puntosReputacion ?? history[0] ?? 0) || 0,
            closed: Number(closedLoans || 0) || 0,
            level: Math.max(1, Number(progress.nivelActual ?? progress[0] ?? 1) || 1),
            delinquent: Boolean(delinquent),
          };
        } catch {
          return { address, fame: 0, closed: 0, level: 1, delinquent: false };
        }
      })
    );
    for (const row of rows) {
      fame.set(row.address.toLowerCase(), row.fame);
      closed.set(row.address.toLowerCase(), row.closed);
      levels.set(row.address.toLowerCase(), row.level);
      mora.set(row.address.toLowerCase(), row.delinquent);
    }
  }

  const players = attachCombinedScores(
    roster.map((address, index) => {
      const keyAddr = address.toLowerCase();
      const loansPaid = Math.max(closed.get(keyAddr) || 0, paidCount.get(keyAddr) || 0);
      return {
        address,
        userNumber: index + 1,
        referrals: referrals.get(keyAddr) || 0,
        loansRequested: requested.get(keyAddr) || 0,
        loansPaid,
        paidUsd: Number(formatUnits(paidWei.get(keyAddr) || 0n, 18)) || 0,
        fame: fame.get(keyAddr) || 0,
        level: levels.get(keyAddr) || 1,
        bonuses: bonusCount.get(keyAddr) || 0,
        bonusUsd: Number(formatUnits(bonusWei.get(keyAddr) || 0n, 18)) || 0,
        delinquent: Boolean(mora.get(keyAddr)),
        combined: 0,
      };
    })
  );

  const snapshot: FameLeaderboardSnapshot = {
    players,
    partial:
      range.partial ||
      rosterTruncated ||
      signups.failed > 0 ||
      issued.failed > 0 ||
      paid.failed > 0 ||
      bonuses.failed > 0,
  };
  cache.set(key, snapshot);
  return snapshot;
}
