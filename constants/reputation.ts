import { formatCommissionUSD } from './commissions';

/** Puntos de red al referidor directo cuando el referido paga su primer L1. */
export const REFERRAL_REPUTATION_POINTS = 50;
/** Puntos de red al activar (el referido paga su primer nivel). Solo el directo. */
export const REFERRAL_NETWORK_POINTS = 50;
/** Cada N puntos de red el pool paga un bono. */
export const REFERRAL_BONUS_THRESHOLD = 250;
/** Bono en USDT desde la caja del pool. */
export const REFERRAL_POOL_BONUS_USD = 0.5;
const GEN1_BP = 1500;
const FOUNDER_FAME_BP = 1500;
const MAX_FAME_LINE = 40;

/** Misma escala que las comisiones de interés (15 / 8 / 6 / 4 / 2 / 0,8 / 0,4 %). */
export function generationBps(gen: number): number {
  if (gen <= 0 || gen > MAX_FAME_LINE) return 0;
  if (gen === 1) return 1500;
  if (gen === 2) return 800;
  if (gen === 3) return 600;
  if (gen === 4) return 400;
  if (gen === 5) return 200;
  if (gen <= 12) return 80;
  return 40;
}

export function fameForGeneration(gen: number): number {
  return Math.floor((REFERRAL_REPUTATION_POINTS * generationBps(gen)) / GEN1_BP);
}

/** Recorte fijo de fama del fundador en cada alta, como el 15 % del interés. */
export function founderFamePoints(): number {
  return Math.floor((REFERRAL_REPUTATION_POINTS * FOUNDER_FAME_BP) / GEN1_BP);
}

export function referralsForNextBonus(puntosRed: number, umbral = REFERRAL_BONUS_THRESHOLD): number {
  const next = (Math.floor(puntosRed / umbral) + 1) * umbral;
  return Math.max(0, next - puntosRed);
}

export function formatPoolBonus(): string {
  return formatCommissionUSD(REFERRAL_POOL_BONUS_USD);
}
