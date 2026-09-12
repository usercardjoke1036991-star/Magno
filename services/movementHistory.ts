import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contract, formatUnits, getAddress, type AbstractProvider } from 'ethers';
import { CONTRACT_ABI, ERC20_ABI, getContractAddress, getUsdtAddress } from '../constants/contractConfig';
import { getKnownStartBlock } from '../constants/deployedAddresses';
import { assertTrustedRpc, getProviderWithFallback, getRuntimeMode, isContractConfigured } from '../constants/rpcConfig';
import { APP_DISPLAY_NAME } from '../constants/brand';
import { getTokenMeta } from '../constants/tokens';

const CHUNK = 4000;
const CHUNK_CONCURRENCY = 3;
const DEFAULT_LOOKBACK = 80_000;
const MAX_SCAN_SPAN = 120_000;
const JOURNAL_PREFIX = 'qc_movements_v1_';

export type MovementKind = 'loan' | 'payment' | 'transfer_out' | 'transfer_in' | 'bonus' | 'donation';

export interface Movement {
  id: string;
  kind: MovementKind;
  from: string;
  to: string;
  amountLabel: string;
  tokenSymbol: string;
  platform: string;
  world: 'demo' | 'live';
  timestamp: number;
  txHash?: string;
  dueAt?: number;
}

export interface MovementSnapshot {
  items: Movement[];
  partial: boolean;
}

const TRANSFER_ABI = [...ERC20_ABI, 'event Transfer(address indexed from, address indexed to, uint256 value)'];

function normalizeAddress(value: string): string {
  try {
    return getAddress(value);
  } catch {
    return '';
  }
}

function journalKey(address: string): string {
  return `${JOURNAL_PREFIX}${getRuntimeMode()}_${address.toLowerCase()}`;
}

async function readJournal(address: string): Promise<Movement[]> {
  try {
    const raw = await AsyncStorage.getItem(journalKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Movement[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJournal(address: string, items: Movement[]): Promise<void> {
  await AsyncStorage.setItem(journalKey(address), JSON.stringify(items.slice(0, 200)));
}

export async function recordMovement(
  address: string,
  entry: Omit<Movement, 'id' | 'world'> & { id?: string }
): Promise<void> {
  const wallet = normalizeAddress(address);
  if (!wallet) return;
  const items = await readJournal(wallet);
  const next: Movement = {
    ...entry,
    id: entry.id || entry.txHash || `local-${Date.now()}-${items.length}`,
    world: getRuntimeMode() === 'live' ? 'live' : 'demo',
  };
  const exists = items.some((item) => item.txHash && next.txHash && item.txHash === next.txHash);
  if (exists) return;
  await writeJournal(wallet, [next, ...items]);
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

function formatToken(amount: bigint, token?: string): { label: string; symbol: string } {
  const meta = token ? getTokenMeta(token) : undefined;
  const decimals = meta?.decimals ?? 18;
  const symbol = meta?.symbol ?? 'USDT';
  return {
    label: `${Number(formatUnits(amount, decimals)).toFixed(4)} ${symbol}`,
    symbol,
  };
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
  return { fromBlock, toBlock: latest, partial: truncated };
}

async function resolveTimestamps(provider: AbstractProvider, blockNumbers: number[]): Promise<Map<number, number>> {
  const unique = [...new Set(blockNumbers.filter((block) => Number.isFinite(block) && block > 0))];
  const stamps = new Map<number, number>();
  for (let i = 0; i < unique.length; i += 6) {
    const batch = unique.slice(i, i + 6);
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

function mergeMovements(local: Movement[], chain: Movement[]): Movement[] {
  const byHash = new Map<string, Movement>();
  const extra: Movement[] = [];
  for (const item of chain) {
    if (item.txHash) byHash.set(item.txHash, item);
    else extra.push(item);
  }
  for (const item of local) {
    if (item.txHash) {
      const prev = byHash.get(item.txHash);
      if (prev) {
        byHash.set(item.txHash, {
          ...prev,
          platform:
            item.platform && item.platform !== 'BSC' && item.platform !== prev.platform
              ? item.platform
              : prev.platform,
        });
      } else {
        byHash.set(item.txHash, item);
      }
    } else {
      extra.push(item);
    }
  }
  return [...byHash.values(), ...extra].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export async function loadMovementHistory(walletAddress: string): Promise<MovementSnapshot> {
  const self = normalizeAddress(walletAddress);
  if (!self) return { items: [], partial: false };
  const local = await readJournal(self);
  if (!isContractConfigured()) return { items: local.sort((a, b) => b.timestamp - a.timestamp), partial: false };

  try {
    const provider = await assertTrustedRpc(getProviderWithFallback());
    const contractAddress = getContractAddress();
    const contract = new Contract(contractAddress, CONTRACT_ABI, provider);
    const tokenAddress = getUsdtAddress();
    const token = new Contract(tokenAddress, TRANSFER_ABI, provider);
    const { fromBlock, toBlock, partial } = await resolveStartBlock(provider, contractAddress);
    const world = getRuntimeMode() === 'live' ? 'live' : 'demo';

    const loanFilter = eventFilter(contract, 'PrestamoEmitido', self);
    const payFilter = eventFilter(contract, 'PrestamoPagado', self);
    const outFilter = eventFilter(token, 'Transfer', self, null);
    const inFilter = eventFilter(token, 'Transfer', null, self);

    const [loanPack, payPack, outPack, inPack] = await Promise.all([
      queryFilterChunked(contract, loanFilter, fromBlock, toBlock),
      queryFilterChunked(contract, payFilter, fromBlock, toBlock),
      queryFilterChunked(token, outFilter, fromBlock, toBlock),
      queryFilterChunked(token, inFilter, fromBlock, toBlock),
    ]);

    const logs = [...loanPack.events, ...payPack.events, ...outPack.events, ...inPack.events];
    const stamps = await resolveTimestamps(
      provider,
      logs.map((event) => event.blockNumber)
    );
    const chain: Movement[] = [];

    for (const event of loanPack.events) {
      const args = eventArgs(event);
      const tokenAddr = String(argValue(args, 'token', 3) || tokenAddress);
      const amount = formatToken(asBigInt(argValue(args, 'monto', 1)), tokenAddr);
      const hash = event.transactionHash;
      chain.push({
        id: hash,
        kind: 'loan',
        from: contractAddress,
        to: self,
        amountLabel: amount.label,
        tokenSymbol: amount.symbol,
        platform: APP_DISPLAY_NAME,
        world,
        timestamp: (stamps.get(event.blockNumber) || 0) * 1000,
        txHash: hash,
        dueAt: Number(argValue(args, 'vencimiento', 2) || 0) * 1000,
      });
    }

    for (const event of payPack.events) {
      const args = eventArgs(event);
      const tokenAddr = String(argValue(args, 'token', 3) || tokenAddress);
      const principal = asBigInt(argValue(args, 'montoPrincipal', 1));
      const fee = asBigInt(argValue(args, 'fee', 2));
      const amount = formatToken(principal + fee, tokenAddr);
      const hash = event.transactionHash;
      chain.push({
        id: hash,
        kind: 'payment',
        from: self,
        to: contractAddress,
        amountLabel: amount.label,
        tokenSymbol: amount.symbol,
        platform: APP_DISPLAY_NAME,
        world,
        timestamp: (stamps.get(event.blockNumber) || 0) * 1000,
        txHash: hash,
      });
    }

    const skip = new Set([contractAddress.toLowerCase(), tokenAddress.toLowerCase()]);
    const creditHashes = new Set(
      [...loanPack.events, ...payPack.events].map((event) => event.transactionHash)
    );
    for (const event of outPack.events) {
      const args = eventArgs(event);
      const to = normalizeAddress(String(argValue(args, 'to', 1) || ''));
      if (to && skip.has(to.toLowerCase())) continue;
      const amount = formatToken(asBigInt(argValue(args, 'value', 2)), tokenAddress);
      const hash = event.transactionHash;
      if (creditHashes.has(hash)) continue;
      chain.push({
        id: `${hash}-out`,
        kind: 'transfer_out',
        from: self,
        to,
        amountLabel: amount.label,
        tokenSymbol: amount.symbol,
        platform: 'BSC',
        world,
        timestamp: (stamps.get(event.blockNumber) || 0) * 1000,
        txHash: hash,
      });
    }

    for (const event of inPack.events) {
      const args = eventArgs(event);
      const from = normalizeAddress(String(argValue(args, 'from', 0) || ''));
      if (from && skip.has(from.toLowerCase())) continue;
      const amount = formatToken(asBigInt(argValue(args, 'value', 2)), tokenAddress);
      const hash = event.transactionHash;
      if (creditHashes.has(hash)) continue;
      chain.push({
        id: `${hash}-in`,
        kind: 'transfer_in',
        from,
        to: self,
        amountLabel: amount.label,
        tokenSymbol: amount.symbol,
        platform: 'BSC',
        world,
        timestamp: (stamps.get(event.blockNumber) || 0) * 1000,
        txHash: hash,
      });
    }

    return {
      items: mergeMovements(local, chain),
      partial: partial || loanPack.failed + payPack.failed + outPack.failed + inPack.failed > 0,
    };
  } catch {
    return { items: local.sort((a, b) => b.timestamp - a.timestamp), partial: true };
  }
}
