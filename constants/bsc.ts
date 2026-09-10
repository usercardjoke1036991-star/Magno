/** Direcciones canónicas de BNB Smart Chain. No usar mocks en chain 56. */

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const BSC_MAINNET = {
  chainId: 56,
  chainName: 'bsc',
  /** Binance-Peg USDT (18 decimales). */
  usdt: '0x55d398326f99059ff775485246999027b3197955',
  usdtUsdFeed: '0xb97ad0e75fa537bf4d14e83bc6b2faab978903a6',
  /** Binance-Peg USDC (18 decimales). No usar el USDC de Ethereum (6 decimales). */
  usdc: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
  /** Chainlink USDC/USD en BSC (BscScan: Chainlink: USDC/USD Price Feed). */
  usdcUsdFeed: '0x51597f405303c4377e36123cbc172b13269ea163',
  /** First Digital USD (18 decimales). */
  fdusd: '0xc5f0f7b66764f6ec8c8dff7ba683102295e16409',
  /** Chainlink FDUSD/USD en BSC (BscScan: Chainlink: Price Feed FDUSD / USD). */
  fdusdUsdFeed: '0x390180e80058a8499930f0c13963ad3e0d86bfc9',
  rpc: [
    'https://bsc-dataseed.binance.org/',
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
  ],
} as const;

export const BSC_TESTNET = {
  chainId: 97,
  chainName: 'bscTestnet',
  /** USDT de faucet Chapel; en este repo el .env puede apuntar a un mock propio. */
  usdt: '0x337610d27c682e347c9cd60bd4b3b107c9d34ddd',
  usdtUsdFeed: '0xeca2605f0bcf2ba5966372c99837b1f182d3d620',
  rpc: [
    'https://bsc-testnet.publicnode.com',
    'https://data-seed-prebsc-1-s1.binance.org:8545/',
    'https://rpc.ankr.com/bsc_testnet_chapel',
  ],
} as const;

const TESTNET_ONLY_TOKENS = new Set([
  BSC_TESTNET.usdt.toLowerCase(),
  '0x2d4ae5e6984d98777a24473f196326ff2604f5a6',
]);

export function isZeroAddress(value: string): boolean {
  return !value || value.toLowerCase() === ZERO_ADDRESS;
}

export function isTestnetOnlyToken(address: string): boolean {
  return TESTNET_ONLY_TOKENS.has(address.trim().toLowerCase());
}
