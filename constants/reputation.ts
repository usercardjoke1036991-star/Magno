import { formatCommissionUSD } from './commissions';

/** Puntos al referidor cuando alguien entra con su código. */
export const REFERRAL_REPUTATION_POINTS = 50;
/** Puntos de red al activar (el referido paga su primer nivel). */
export const REFERRAL_NETWORK_POINTS = 50;
/** Cada N puntos de red el pool paga un bono. */
export const REFERRAL_BONUS_THRESHOLD = 250;
/** Bono en USDT desde la caja del pool. */
export const REFERRAL_POOL_BONUS_USD = 0.5;

export function referralsForNextBonus(puntosRed: number, umbral = REFERRAL_BONUS_THRESHOLD): number {
  const next = (Math.floor(puntosRed / umbral) + 1) * umbral;
  return Math.max(0, next - puntosRed);
}

export function formatPoolBonus(): string {
  return formatCommissionUSD(REFERRAL_POOL_BONUS_USD);
}
