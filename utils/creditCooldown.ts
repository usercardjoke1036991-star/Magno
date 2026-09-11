/** Igual que `QuatriviumCredit.COOLDOWN_PRESTAMO` (48 hours). */
export const PRESTAMO_COOLDOWN_SECS = 48 * 60 * 60;

/**
 * Countdown local. `obtenerCooldownRestante` cambia cada segundo y
 * FallbackProvider exige quorum de resultados idénticos entre RPC.
 */
export function cooldownRestanteDesdeTimestamp(
  ultimoPrestamoTimestamp: number,
  nowSec: number = Math.floor(Date.now() / 1000),
): number {
  if (!Number.isFinite(ultimoPrestamoTimestamp) || ultimoPrestamoTimestamp <= 0) {
    return 0;
  }
  return Math.max(0, Math.floor(ultimoPrestamoTimestamp) + PRESTAMO_COOLDOWN_SECS - nowSec);
}
