import { isDemoAccount } from '../constants/rpcConfig';

export type LiveCreditFlags = {
  kycDeclarado: boolean;
  identityBound: boolean;
  hasEmail: boolean;
  phraseBackedUp: boolean;
  deviceMatches: boolean;
  /** False si el usuario quitó el número en Ajustes. */
  phoneActive?: boolean;
};

/** Cuenta Real: KYC obligatorio antes de pedir. Demo no lo pide. */
export function liveNeedsKyc(demo: boolean, kycDeclarado: boolean): boolean {
  return !demo && !kycDeclarado;
}

/** Cuenta Real: número activo en la cuenta. Si lo quita, hay que volver a verificar. Demo no lo pide. */
export function liveNeedsPhone(demo: boolean, identityBound: boolean, phoneActive = true): boolean {
  return !demo && !(identityBound && phoneActive);
}

/** Teléfono listo para crédito: atado, no quitado, y este aparato coincide o se reanuda en segundo plano. */
export function phoneVerifiedOnThisDevice(
  identityBound: boolean,
  deviceMatches: boolean,
  phoneActive = true
): boolean {
  return Boolean(identityBound) && Boolean(phoneActive) && Boolean(deviceMatches);
}

/** Cuenta Real: correo de la cuenta en este teléfono. Demo no lo pide. */
export function liveNeedsEmail(demo: boolean, hasEmail: boolean): boolean {
  return !demo && !hasEmail;
}

/** Anotar las 24 palabras antes de pedir crédito. Demo y Real. */
export function liveNeedsPhrase(phraseBackedUp: boolean): boolean {
  return !phraseBackedUp;
}

/** Cuenta Real: si el número sigue en la cuenta, el aparato se reanuda sin otro OTP. */
export function liveNeedsDeviceMatch(demo: boolean, deviceMatches: boolean, phoneActive = false): boolean {
  if (demo || phoneActive) return false;
  return !deviceMatches;
}

/** Cuenta Real: 1 USDT de acceso una vez. Demo no lo pide. */
export function liveNeedsAccess(demo: boolean, paidUsd: number): boolean {
  return !demo && !hasCreditAccess(paidUsd);
}

export function liveCreditReady(demo: boolean, flags: LiveCreditFlags): boolean {
  return (
    !liveNeedsPhrase(flags.phraseBackedUp) &&
    !liveNeedsEmail(demo, flags.hasEmail) &&
    !liveNeedsPhone(demo, flags.identityBound, flags.phoneActive !== false) &&
    !liveNeedsKyc(demo, flags.kycDeclarado) &&
    !liveNeedsDeviceMatch(demo, flags.deviceMatches, Boolean(flags.phoneActive))
  );
}

export type LoanGateBannerRow = 'phrase' | 'email' | 'kyc' | 'phone';

/** Correo, número y KYC solo en Real, después del 1 USDT. Demo no abre esa verificación. */
export function identityUnlocked(paidUsd: number): boolean {
  if (isDemoAccount()) return false;
  return hasCreditAccess(paidUsd);
}

/** En el hub solo quedan los requisitos de préstamo que aún no están confirmados. */
export function loanGateBannerRows(input: {
  phraseDone: boolean;
  accessPaid?: boolean;
  showIdentity: boolean;
  emailDone: boolean;
  kycDone: boolean;
  phoneDone: boolean;
}): LoanGateBannerRow[] {
  const rows: LoanGateBannerRow[] = [];
  if (!input.phraseDone) rows.push('phrase');
  if (!input.accessPaid || !input.showIdentity) return rows;
  if (!input.emailDone) rows.push('email');
  if (!input.kycDone) rows.push('kyc');
  if (!input.phoneDone) rows.push('phone');
  return rows;
}

export function liveCreditBlockReason(
  demo: boolean,
  flags: LiveCreditFlags
): 'phrase' | 'email' | 'phone' | 'kyc' | 'device' | null {
  if (liveNeedsPhrase(flags.phraseBackedUp)) return 'phrase';
  if (liveNeedsEmail(demo, flags.hasEmail)) return 'email';
  if (liveNeedsPhone(demo, flags.identityBound, flags.phoneActive !== false)) return 'phone';
  if (liveNeedsKyc(demo, flags.kycDeclarado)) return 'kyc';
  if (liveNeedsDeviceMatch(demo, flags.deviceMatches, Boolean(flags.phoneActive))) return 'device';
  return null;
}

export function creditNeedsKyc(userInfo: { kycDeclarado: boolean }): boolean {
  return liveNeedsKyc(isDemoAccount(), Boolean(userInfo.kycDeclarado));
}

export function creditNeedsPhone(userInfo: { identityBound: boolean }, phoneActive = true): boolean {
  return liveNeedsPhone(isDemoAccount(), Boolean(userInfo.identityBound), phoneActive);
}

export function creditNeedsEmail(hasEmail: boolean): boolean {
  return liveNeedsEmail(isDemoAccount(), hasEmail);
}

export function creditNeedsPhrase(phraseBackedUp: boolean): boolean {
  return liveNeedsPhrase(phraseBackedUp);
}

export function creditNeedsDeviceMatch(deviceMatches: boolean, phoneActive = false): boolean {
  return liveNeedsDeviceMatch(isDemoAccount(), deviceMatches, phoneActive);
}

export const CREDIT_ACCESS_USDT = 1;
/** Real: cada confirmación de correo cobra 0.50 USDT a la fundadora. Demo: 0. */
export const CREDIT_VERIFY_EMAIL_USDT = 0.5;
/** Real: cada confirmación de número cobra 0.50 USDT a la fundadora. Demo: 0. */
export const CREDIT_VERIFY_PHONE_USDT = 0.5;

export type VerificationFeeKind = 'email' | 'phone';

/** Tarifa de verificación. Demo no cobra. No sale del pool. */
export function verificationFeeUsdt(kind: VerificationFeeKind, demo = false): number {
  if (demo) return 0;
  return kind === 'email' ? CREDIT_VERIFY_EMAIL_USDT : CREDIT_VERIFY_PHONE_USDT;
}

export function verificationFeeLabel(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  return amount.toFixed(2);
}

/** 1 USDT de acceso pagado on-chain. El candado de la app solo aplica en Real. */
export function hasCreditAccess(paidUsd: number): boolean {
  const paid = Number(paidUsd);
  return Number.isFinite(paid) && paid + 1e-9 >= CREDIT_ACCESS_USDT;
}

/** Donaciones voluntarias: acceso y verificaciones silenciosas no cuentan como apoyo extra. */
export function voluntaryDonateUsd(paidUsd: number): number {
  const paid = Number(paidUsd);
  if (!Number.isFinite(paid) || paid <= 0) return 0;
  if (!hasCreditAccess(paid)) return 0;
  const extra = paid - CREDIT_ACCESS_USDT;
  const hidden = Math.min(extra, CREDIT_VERIFY_EMAIL_USDT + CREDIT_VERIFY_PHONE_USDT);
  return Math.max(0, extra - hidden);
}

/** Cobros de 0.50 USDT de correo/número: no se muestran en historial ni como donación. */
export function isHiddenVerificationDonation(usdAmount: number, isFirstDonation: boolean): boolean {
  if (isFirstDonation) return false;
  const usd = Number(usdAmount);
  if (!Number.isFinite(usd) || usd <= 0) return false;
  return (
    Math.abs(usd - CREDIT_VERIFY_EMAIL_USDT) < 1e-6 ||
    Math.abs(usd - CREDIT_VERIFY_PHONE_USDT) < 1e-6
  );
}

/** Primera donación de 1 USDT = acceso. Cualquier monto mayor o posterior = donar. */
export function classifyDonationKind(usdAmount: number, isFirstDonation: boolean): 'access' | 'donation' {
  const usd = Number(usdAmount);
  if (
    isFirstDonation &&
    Number.isFinite(usd) &&
    usd > 0 &&
    usd <= CREDIT_ACCESS_USDT + 1e-6
  ) {
    return 'access';
  }
  return 'donation';
}

export function creditNeedsAccess(paidUsd: number): boolean {
  return liveNeedsAccess(isDemoAccount(), paidUsd);
}

/** El botón de 1 USDT se enciende si el contrato puede donar y hay destino. No usa la sala Donar. */
export function canPayCreditAccess(input: {
  protocolCanDonate: boolean;
  founderAddress: string;
  accessEnabled: boolean;
}): boolean {
  return Boolean(input.protocolCanDonate && String(input.founderAddress || '').trim() && input.accessEnabled);
}

/** Línea activa solo si el contrato del mundo actual existe. Real no hereda el registro de Demo. */
export function creditLineLooksActive(
  creditReady: boolean,
  isRegistered: boolean,
  hasActiveLoan: boolean
): boolean {
  return Boolean(creditReady && (isRegistered || hasActiveLoan));
}

/** No hidratar crédito cacheado si el mundo no tiene contrato o ya llegó el RPC. */
export function canHydrateCreditStatus(input: {
  configured: boolean;
  chainReady: boolean;
  savedContract?: string;
  currentContract: string;
}): boolean {
  if (!input.configured || input.chainReady) return false;
  const saved = String(input.savedContract || '').trim().toLowerCase();
  const current = String(input.currentContract || '').trim().toLowerCase();
  if (saved && current && saved !== current) return false;
  return true;
}

export function identityHashBound(value: string | null | undefined): boolean {
  const hash = String(value || '');
  return Boolean(hash) && !/^0x0+$/i.test(hash);
}
