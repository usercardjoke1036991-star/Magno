import { formatUSD } from '../utils/formatters';

export const DIRECT_COMMISSION_BPS = 1500;
export const ACTIVATION_BONUS_USD = 1;

export function interestFromLoan(usdAmount: number, interestBps: number): number {
  return (usdAmount * interestBps) / 10000;
}

export function directCommissionFromLoan(usdAmount: number, interestBps: number): number {
  return (interestFromLoan(usdAmount, interestBps) * DIRECT_COMMISSION_BPS) / 10000;
}

export function formatCommissionUSD(amount: number): string {
  if (amount >= 1) return formatUSD(amount);
  if (amount >= 0.01) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(4)}`;
}
