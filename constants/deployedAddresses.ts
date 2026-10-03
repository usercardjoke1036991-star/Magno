/** Direcciones públicas ya desplegadas. Mainnet se rellena tras `npm run deploy:bsc`. */
/** Demo legado en Chapel. No parchear. */
export const LEGACY_DEMO_TESTNET = '0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f' as const;

export const DEPLOYED_TESTNET = {
  chainId: 97,
  contract: '0xD318f39834A5e798a11D2535c6c9D1E1270e6778',
  usdt: '0x2d4AE5E6984D98777a24473F196326ff2604F5A6',
  reserva: '0x98bEd5162770621Dd57458C9BFbEC14aEfD147C8',
  fama: '0xEC2793986aE252993e179a5D7F3410c4A076a711',
  alta: '0xE890627734D7350132988561247945624991f063',
  startBlock: 134721274,
} as const;

export const DEPLOYED_MAINNET = {
  chainId: 56,
  contract: '',
  usdt: '0x55d398326f99059ff775485246999027b3197955',
  reserva: '',
  fama: '',
  alta: '',
  /** Billetera personal Real (donaciones). El contrato mainnet sigue vacío hasta el deploy. */
  founder: '0x5023bf46dB7458B9bb9152a7ffE64f195CD1a047',
  startBlock: 0,
} as const;

export function getRealDonationWallet(): string {
  return String(DEPLOYED_MAINNET.founder || '').trim();
}

export function getKnownStartBlock(contractAddress: string): number {
  const addr = String(contractAddress || '').toLowerCase();
  if (!addr) return 0;
  if (addr === DEPLOYED_TESTNET.contract.toLowerCase()) return DEPLOYED_TESTNET.startBlock;
  const official = String(DEPLOYED_MAINNET.contract || '').toLowerCase();
  if (official && addr === official) return DEPLOYED_MAINNET.startBlock;
  return 0;
}
