/** Direcciones públicas ya desplegadas. Mainnet se rellena tras `npm run deploy:bsc`. */
export const DEPLOYED_TESTNET = {
  chainId: 97,
  contract: '0x5eB6c65f3e3b7DC555e690A83d61205F66700cC2',
  usdt: '0x2d4AE5E6984D98777a24473F196326ff2604F5A6',
} as const;

export const DEPLOYED_MAINNET = {
  chainId: 56,
  contract: '',
  usdt: '0x55d398326f99059ff775485246999027b3197955',
} as const;
