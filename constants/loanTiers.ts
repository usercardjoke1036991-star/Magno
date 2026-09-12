export const MAX_LOAN_LEVEL = 100;
export const MAX_LOAN_USD = 10000;
/** Primer nivel de 100 USDT. A partir de aquí las solicitudes suben de 5 en 5. */
export const USD100_LEVEL = 10;
/** Bono repetible del pool al completar la racha del nivel 100. */
export const MAX_LEVEL_BONUS_USD = 2000;

/** Lo que exige el contrato live hoy: 3 en L1, 5 en L2–99. El 100 no sube. */
export function requiredCountForLevel(id: number): number {
  if (id < 1 || id >= MAX_LOAN_LEVEL) return 0;
  if (id <= 1) return 3;
  return 5;
}

/** Escalera del hermano `QuatriviumLeveling` (próximo deploy). */
export function requiredCountPlanned(id: number): number {
  if (id < 1 || id > MAX_LOAN_LEVEL) return 0;
  if (id <= 5) return 3;
  if (id < USD100_LEVEL) return 5;
  return 5 * (id - 9);
}

export interface LoanTier {
  id: number;
  name: string;
  usdAmount: number;
  term: string;
  termDays: number;
  requiredCount: number;
  interestBps: number;
  installments: number;
}

/** 100 niveles: monto e interés $ suben; la tasa del anterior siempre es más cara que la del siguiente. */
export const LOAN_TIER_ROWS: ReadonlyArray<Omit<LoanTier, 'name' | 'term'>> = [
  { id: 1, usdAmount: 1, termDays: 7, requiredCount: 3, interestBps: 10000, installments: 1 },
  { id: 2, usdAmount: 2, termDays: 10, requiredCount: 5, interestBps: 9500, installments: 1 },
  { id: 3, usdAmount: 5, termDays: 15, requiredCount: 5, interestBps: 8000, installments: 1 },
  { id: 4, usdAmount: 10, termDays: 20, requiredCount: 5, interestBps: 7000, installments: 1 },
  { id: 5, usdAmount: 20, termDays: 25, requiredCount: 5, interestBps: 5000, installments: 1 },
  { id: 6, usdAmount: 35, termDays: 30, requiredCount: 5, interestBps: 4800, installments: 1 },
  { id: 7, usdAmount: 50, termDays: 35, requiredCount: 5, interestBps: 4000, installments: 2 },
  { id: 8, usdAmount: 60, termDays: 40, requiredCount: 5, interestBps: 3800, installments: 3 },
  { id: 9, usdAmount: 80, termDays: 45, requiredCount: 5, interestBps: 3600, installments: 3 },
  { id: 10, usdAmount: 100, termDays: 50, requiredCount: 5, interestBps: 3400, installments: 3 },
  { id: 11, usdAmount: 120, termDays: 50, requiredCount: 5, interestBps: 3371, installments: 3 },
  { id: 12, usdAmount: 130, termDays: 51, requiredCount: 5, interestBps: 3342, installments: 3 },
  { id: 13, usdAmount: 135, termDays: 51, requiredCount: 5, interestBps: 3313, installments: 3 },
  { id: 14, usdAmount: 140, termDays: 52, requiredCount: 5, interestBps: 3284, installments: 3 },
  { id: 15, usdAmount: 150, termDays: 52, requiredCount: 5, interestBps: 3256, installments: 3 },
  { id: 16, usdAmount: 155, termDays: 53, requiredCount: 5, interestBps: 3227, installments: 3 },
  { id: 17, usdAmount: 160, termDays: 53, requiredCount: 5, interestBps: 3198, installments: 3 },
  { id: 18, usdAmount: 170, termDays: 54, requiredCount: 5, interestBps: 3169, installments: 3 },
  { id: 19, usdAmount: 180, termDays: 54, requiredCount: 5, interestBps: 3140, installments: 3 },
  { id: 20, usdAmount: 190, termDays: 54, requiredCount: 5, interestBps: 3111, installments: 3 },
  { id: 21, usdAmount: 200, termDays: 55, requiredCount: 5, interestBps: 3082, installments: 3 },
  { id: 22, usdAmount: 210, termDays: 55, requiredCount: 5, interestBps: 3053, installments: 3 },
  { id: 23, usdAmount: 220, termDays: 56, requiredCount: 5, interestBps: 3024, installments: 3 },
  { id: 24, usdAmount: 230, termDays: 56, requiredCount: 5, interestBps: 2996, installments: 3 },
  { id: 25, usdAmount: 240, termDays: 57, requiredCount: 5, interestBps: 2967, installments: 3 },
  { id: 26, usdAmount: 250, termDays: 57, requiredCount: 5, interestBps: 2938, installments: 3 },
  { id: 27, usdAmount: 270, termDays: 58, requiredCount: 5, interestBps: 2909, installments: 3 },
  { id: 28, usdAmount: 280, termDays: 58, requiredCount: 5, interestBps: 2880, installments: 3 },
  { id: 29, usdAmount: 290, termDays: 58, requiredCount: 5, interestBps: 2851, installments: 3 },
  { id: 30, usdAmount: 310, termDays: 59, requiredCount: 5, interestBps: 2822, installments: 3 },
  { id: 31, usdAmount: 320, termDays: 59, requiredCount: 5, interestBps: 2793, installments: 3 },
  { id: 32, usdAmount: 340, termDays: 60, requiredCount: 5, interestBps: 2764, installments: 3 },
  { id: 33, usdAmount: 360, termDays: 60, requiredCount: 5, interestBps: 2736, installments: 3 },
  { id: 34, usdAmount: 380, termDays: 61, requiredCount: 5, interestBps: 2707, installments: 3 },
  { id: 35, usdAmount: 400, termDays: 61, requiredCount: 5, interestBps: 2678, installments: 3 },
  { id: 36, usdAmount: 420, termDays: 62, requiredCount: 5, interestBps: 2649, installments: 3 },
  { id: 37, usdAmount: 440, termDays: 62, requiredCount: 5, interestBps: 2620, installments: 3 },
  { id: 38, usdAmount: 460, termDays: 62, requiredCount: 5, interestBps: 2591, installments: 3 },
  { id: 39, usdAmount: 480, termDays: 63, requiredCount: 5, interestBps: 2562, installments: 3 },
  { id: 40, usdAmount: 500, termDays: 63, requiredCount: 5, interestBps: 2533, installments: 3 },
  { id: 41, usdAmount: 525, termDays: 64, requiredCount: 5, interestBps: 2504, installments: 3 },
  { id: 42, usdAmount: 550, termDays: 64, requiredCount: 5, interestBps: 2476, installments: 3 },
  { id: 43, usdAmount: 600, termDays: 65, requiredCount: 5, interestBps: 2447, installments: 3 },
  { id: 44, usdAmount: 625, termDays: 65, requiredCount: 5, interestBps: 2418, installments: 3 },
  { id: 45, usdAmount: 650, termDays: 66, requiredCount: 5, interestBps: 2389, installments: 3 },
  { id: 46, usdAmount: 675, termDays: 66, requiredCount: 5, interestBps: 2360, installments: 3 },
  { id: 47, usdAmount: 725, termDays: 66, requiredCount: 5, interestBps: 2331, installments: 3 },
  { id: 48, usdAmount: 750, termDays: 67, requiredCount: 5, interestBps: 2302, installments: 3 },
  { id: 49, usdAmount: 800, termDays: 67, requiredCount: 5, interestBps: 2273, installments: 3 },
  { id: 50, usdAmount: 825, termDays: 68, requiredCount: 5, interestBps: 2244, installments: 3 },
  { id: 51, usdAmount: 875, termDays: 68, requiredCount: 5, interestBps: 2216, installments: 3 },
  { id: 52, usdAmount: 925, termDays: 69, requiredCount: 5, interestBps: 2187, installments: 3 },
  { id: 53, usdAmount: 975, termDays: 69, requiredCount: 5, interestBps: 2158, installments: 3 },
  { id: 54, usdAmount: 1025, termDays: 70, requiredCount: 5, interestBps: 2129, installments: 3 },
  { id: 55, usdAmount: 1075, termDays: 70, requiredCount: 5, interestBps: 2100, installments: 3 },
  { id: 56, usdAmount: 1125, termDays: 70, requiredCount: 5, interestBps: 2071, installments: 3 },
  { id: 57, usdAmount: 1175, termDays: 71, requiredCount: 5, interestBps: 2042, installments: 3 },
  { id: 58, usdAmount: 1250, termDays: 71, requiredCount: 5, interestBps: 2013, installments: 3 },
  { id: 59, usdAmount: 1300, termDays: 72, requiredCount: 5, interestBps: 1984, installments: 3 },
  { id: 60, usdAmount: 1375, termDays: 72, requiredCount: 5, interestBps: 1956, installments: 3 },
  { id: 61, usdAmount: 1450, termDays: 73, requiredCount: 5, interestBps: 1927, installments: 3 },
  { id: 62, usdAmount: 1525, termDays: 73, requiredCount: 5, interestBps: 1898, installments: 3 },
  { id: 63, usdAmount: 1600, termDays: 74, requiredCount: 5, interestBps: 1869, installments: 3 },
  { id: 64, usdAmount: 1675, termDays: 74, requiredCount: 5, interestBps: 1840, installments: 3 },
  { id: 65, usdAmount: 1750, termDays: 74, requiredCount: 5, interestBps: 1811, installments: 3 },
  { id: 66, usdAmount: 1850, termDays: 75, requiredCount: 5, interestBps: 1782, installments: 3 },
  { id: 67, usdAmount: 1950, termDays: 75, requiredCount: 5, interestBps: 1753, installments: 3 },
  { id: 68, usdAmount: 2050, termDays: 76, requiredCount: 5, interestBps: 1724, installments: 3 },
  { id: 69, usdAmount: 2150, termDays: 76, requiredCount: 5, interestBps: 1696, installments: 3 },
  { id: 70, usdAmount: 2250, termDays: 77, requiredCount: 5, interestBps: 1667, installments: 3 },
  { id: 71, usdAmount: 2350, termDays: 77, requiredCount: 5, interestBps: 1638, installments: 3 },
  { id: 72, usdAmount: 2500, termDays: 78, requiredCount: 5, interestBps: 1609, installments: 3 },
  { id: 73, usdAmount: 2600, termDays: 78, requiredCount: 5, interestBps: 1580, installments: 3 },
  { id: 74, usdAmount: 2750, termDays: 78, requiredCount: 5, interestBps: 1551, installments: 3 },
  { id: 75, usdAmount: 2900, termDays: 79, requiredCount: 5, interestBps: 1522, installments: 3 },
  { id: 76, usdAmount: 3050, termDays: 79, requiredCount: 5, interestBps: 1493, installments: 3 },
  { id: 77, usdAmount: 3200, termDays: 80, requiredCount: 5, interestBps: 1464, installments: 3 },
  { id: 78, usdAmount: 3350, termDays: 80, requiredCount: 5, interestBps: 1436, installments: 3 },
  { id: 79, usdAmount: 3500, termDays: 81, requiredCount: 5, interestBps: 1407, installments: 3 },
  { id: 80, usdAmount: 3700, termDays: 81, requiredCount: 5, interestBps: 1378, installments: 3 },
  { id: 81, usdAmount: 3900, termDays: 82, requiredCount: 5, interestBps: 1349, installments: 3 },
  { id: 82, usdAmount: 4100, termDays: 82, requiredCount: 5, interestBps: 1320, installments: 3 },
  { id: 83, usdAmount: 4300, termDays: 82, requiredCount: 5, interestBps: 1291, installments: 3 },
  { id: 84, usdAmount: 4500, termDays: 83, requiredCount: 5, interestBps: 1262, installments: 3 },
  { id: 85, usdAmount: 4750, termDays: 83, requiredCount: 5, interestBps: 1233, installments: 3 },
  { id: 86, usdAmount: 5000, termDays: 84, requiredCount: 5, interestBps: 1204, installments: 3 },
  { id: 87, usdAmount: 5200, termDays: 84, requiredCount: 5, interestBps: 1176, installments: 3 },
  { id: 88, usdAmount: 5500, termDays: 85, requiredCount: 5, interestBps: 1147, installments: 3 },
  { id: 89, usdAmount: 5800, termDays: 85, requiredCount: 5, interestBps: 1118, installments: 3 },
  { id: 90, usdAmount: 6100, termDays: 86, requiredCount: 5, interestBps: 1089, installments: 3 },
  { id: 91, usdAmount: 6400, termDays: 86, requiredCount: 5, interestBps: 1060, installments: 3 },
  { id: 92, usdAmount: 6700, termDays: 86, requiredCount: 5, interestBps: 1031, installments: 3 },
  { id: 93, usdAmount: 7100, termDays: 87, requiredCount: 5, interestBps: 1002, installments: 3 },
  { id: 94, usdAmount: 7400, termDays: 87, requiredCount: 5, interestBps: 973, installments: 3 },
  { id: 95, usdAmount: 7800, termDays: 88, requiredCount: 5, interestBps: 944, installments: 3 },
  { id: 96, usdAmount: 8200, termDays: 88, requiredCount: 5, interestBps: 916, installments: 3 },
  { id: 97, usdAmount: 8600, termDays: 89, requiredCount: 5, interestBps: 887, installments: 3 },
  { id: 98, usdAmount: 9100, termDays: 89, requiredCount: 5, interestBps: 858, installments: 3 },
  { id: 99, usdAmount: 9500, termDays: 90, requiredCount: 5, interestBps: 829, installments: 3 },
  { id: 100, usdAmount: 10000, termDays: 90, requiredCount: 0, interestBps: 800, installments: 3 },
];

export const LOAN_TIERS: LoanTier[] = LOAN_TIER_ROWS.map((row) => ({
  ...row,
  requiredCount: requiredCountForLevel(row.id),
  name: `Nivel ${row.id}`,
  term: `${row.termDays} días`,
}));

export function installmentsForPrincipalWei(monto: bigint): number {
  if (monto >= 60n * 10n ** 18n) return 3;
  if (monto >= 50n * 10n ** 18n) return 2;
  return 1;
}

export function overlayOnChainTier(
  base: LoanTier,
  monto: bigint,
  plazo: bigint,
  tasaBps: bigint
): LoanTier {
  if (monto === 0n) return base;
  const usdAmount = Number(monto) / 1e18;
  const days = Math.max(1, Math.round(Number(plazo) / 86400));
  return {
    ...base,
    usdAmount,
    interestBps: Number(tasaBps),
    termDays: days,
    term: `${days} días`,
    installments: installmentsForPrincipalWei(monto),
  };
}
