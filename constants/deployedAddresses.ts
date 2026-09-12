/** Direcciones públicas ya desplegadas. Mainnet se rellena tras `npm run deploy:bsc`. */
export const DEPLOYED_TESTNET = {
  chainId: 97,
  contract: '0x1E5118B378c7BCB3F3c5de7ec046B93E60f417a3',
  usdt: '0x2d4AE5E6984D98777a24473F196326ff2604F5A6',
  startBlock: 130526896,
} as const;

export const DEPLOYED_MAINNET = {
  chainId: 56,
  contract: '',
  usdt: '0x55d398326f99059ff775485246999027b3197955',
  startBlock: 0,
} as const;

export function getKnownStartBlock(contractAddress: string): number {
  const addr = String(contractAddress || '').toLowerCase();
  if (!addr) return 0;
  if (addr === DEPLOYED_TESTNET.contract.toLowerCase()) return DEPLOYED_TESTNET.startBlock;
  const official = String(DEPLOYED_MAINNET.contract || '').toLowerCase();
  if (official && addr === official) return DEPLOYED_MAINNET.startBlock;
  return 0;
}
