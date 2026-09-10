export interface LoanTier {
  id: number;
  name: string;
  usdAmount: number;
  term: string;
  requiredCount: number;
  interestBps: number;
  installments: number;
}

export const LOAN_TIERS: LoanTier[] = [
  { id: 1, name: 'Semilla', usdAmount: 1, term: '7 días', requiredCount: 3, interestBps: 10000, installments: 1 },
  { id: 2, name: 'Inicial', usdAmount: 2, term: '10 días', requiredCount: 5, interestBps: 10000, installments: 1 },
  { id: 3, name: 'Micro', usdAmount: 5, term: '15 días', requiredCount: 5, interestBps: 8000, installments: 1 },
  { id: 4, name: 'Plus', usdAmount: 10, term: '20 días', requiredCount: 5, interestBps: 7000, installments: 1 },
  { id: 5, name: 'Avance', usdAmount: 20, term: '25 días', requiredCount: 5, interestBps: 5000, installments: 1 },
  { id: 6, name: 'Crecimiento', usdAmount: 35, term: '30 días', requiredCount: 5, interestBps: 5714, installments: 1 },
  { id: 7, name: 'Escala', usdAmount: 50, term: '35 días', requiredCount: 5, interestBps: 4000, installments: 2 },
  { id: 8, name: 'Avanzado', usdAmount: 60, term: '40 días', requiredCount: 5, interestBps: 5000, installments: 3 },
  { id: 9, name: 'Elite', usdAmount: 80, term: '45 días', requiredCount: 5, interestBps: 5000, installments: 3 },
  { id: 10, name: 'Máximo', usdAmount: 100, term: '50 días', requiredCount: 0, interestBps: 5000, installments: 3 },
];

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
    term: `${days} días`,
    installments: installmentsForPrincipalWei(monto),
  };
}
