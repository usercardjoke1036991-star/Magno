import { getUsdtAddress } from './contractConfig';
import { BSC_MAINNET } from './bsc';
import { DEPLOYED_TESTNET } from './deployedAddresses';
import { isDemoMode } from './rpcConfig';

export interface Token {
  symbol: string;
  address: string;
  decimals: number;
  priceUSD: number;
  color: string;
}

export interface ConfigurableStable {
  symbol: string;
  address: string;
  feed: string;
}

const USDT_META: Omit<Token, 'address'> = {
  symbol: 'USDT',
  decimals: 18,
  priceUSD: 1.0,
  color: '#26A17B',
};

const USDC_META: Omit<Token, 'address'> = {
  symbol: 'USDC',
  decimals: 18,
  priceUSD: 1.0,
  color: '#2775CA',
};

const FDUSD_META: Omit<Token, 'address'> = {
  symbol: 'FDUSD',
  decimals: 18,
  priceUSD: 1.0,
  color: '#111111',
};

/** USDC y FDUSD solo en mainnet: en Chapel no hay mocks ni feeds equivalentes. */
export function getConfigurableStables(): ConfigurableStable[] {
  if (isDemoMode()) return [];
  return [
    { symbol: 'USDC', address: BSC_MAINNET.usdc, feed: BSC_MAINNET.usdcUsdFeed },
    { symbol: 'FDUSD', address: BSC_MAINNET.fdusd, feed: BSC_MAINNET.fdusdUsdFeed },
  ];
}

export function getSupportedTokens(): Token[] {
  const usdt: Token = {
    ...USDT_META,
    address: isDemoMode() ? getUsdtAddress() : BSC_MAINNET.usdt,
  };
  if (isDemoMode()) return [usdt];
  return [
    usdt,
    { ...USDC_META, address: BSC_MAINNET.usdc },
    { ...FDUSD_META, address: BSC_MAINNET.fdusd },
  ];
}

export function getTokenMeta(address: string): Token | undefined {
  const needle = address.toLowerCase();
  return getSupportedTokens().find((token) => token.address.toLowerCase() === needle);
}

/** USDT oficial del mundo activo. Un RPC caído no debe tratarlo como «token apagado». */
export function isOfficialWorldToken(address: string): boolean {
  const needle = (address || '').trim().toLowerCase();
  if (!needle.startsWith('0x') || needle.length !== 42) return false;
  if (isDemoMode()) {
    return needle === getUsdtAddress().toLowerCase() || needle === DEPLOYED_TESTNET.usdt.toLowerCase();
  }
  return needle === BSC_MAINNET.usdt.toLowerCase();
}
