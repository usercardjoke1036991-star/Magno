/** Direcciones públicas ya desplegadas. Mainnet se rellena tras `npm run deploy:bsc`. */
/** Demo legado en Chapel. No parchear. */
export const LEGACY_DEMO_TESTNET = '0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f' as const;

export const DEPLOYED_TESTNET = {
  chainId: 97,
  contract: '0xdF21Ec0bCBFb6F03b6929De4b37B3B6c40d31F5a',
  usdt: '0x2d4AE5E6984D98777a24473F196326ff2604F5A6',
  reserva: '0x9058C95bBdde3B215f86908aE66F1B2C03180420',
  fama: '0x74914FD88E98F18f2D27EC343c00f28FcDA981F4',
  alta: '0xa590f241868560AF3f9E2017c7d629FFDEA27e2B',
  startBlock: 134587928,
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
