import { DIRECT_COMMISSION_BPS, formatCommissionUSD, generationCommissionBps } from './commissions';

/** PUNTOS_POR_REFERIDO: solo al padrino directo cuando el referido paga su primer L1. */
export const REFERRAL_REPUTATION_POINTS = 50;
/** Alias de PUNTOS_POR_REFERIDO. No se acredita a generaciones 2–40. */
export const REFERRAL_NETWORK_POINTS = 50;
/** UMBRAL_BONO_RED */
export const REFERRAL_BONUS_THRESHOLD = 250;
/** BONO_RED_USDT */
export const REFERRAL_POOL_BONUS_USD = 0.5;
const FOUNDER_FAME_BP = 1500;

export function generationBps(gen: number): number {
  return generationCommissionBps(gen);
}

export function fameForGeneration(gen: number): number {
  return Math.floor((REFERRAL_REPUTATION_POINTS * generationBps(gen)) / DIRECT_COMMISSION_BPS);
}

/** Recorte fijo de fama del fundador en cada alta, como el 15 % del interés. */
export function founderFamePoints(): number {
  return Math.floor((REFERRAL_REPUTATION_POINTS * FOUNDER_FAME_BP) / DIRECT_COMMISSION_BPS);
}

export function referralsForNextBonus(puntosRed: number, umbral = REFERRAL_BONUS_THRESHOLD): number {
  const next = (Math.floor(puntosRed / umbral) + 1) * umbral;
  return Math.max(0, next - puntosRed);
}

export function formatPoolBonus(): string {
  return formatCommissionUSD(REFERRAL_POOL_BONUS_USD);
}
