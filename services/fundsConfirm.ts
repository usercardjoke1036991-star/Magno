import { isAuthEnabled } from './authPrefs';

export type FundsConfirmPurpose = 'transfer' | 'loanRequest' | 'loanPay';
export type LoanConfirmKind = 'loanRequest' | 'loanPay';

export async function isFundsConfirmEnabled(): Promise<boolean> {
  return isAuthEnabled('funds');
}

export async function isLoanConfirmEnabled(kind: LoanConfirmKind): Promise<boolean> {
  return isAuthEnabled(kind);
}

export async function setFundsConfirmEnabled(_enabled: boolean): Promise<void> {
  // Los interruptores viven en Cómo confirma (authPrefs).
}

export async function setLoanConfirmEnabled(_kind: LoanConfirmKind, _enabled: boolean): Promise<void> {
  // Los interruptores viven en Cómo confirma (authPrefs).
}
