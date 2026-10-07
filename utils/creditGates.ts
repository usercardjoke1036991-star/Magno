import { CREDIT_ALTA_USDT, isAltaConfigured } from '../constants/altaConfig';
import { isDemoAccount } from '../constants/rpcConfig';

export type LiveCreditFlags = {
  kycDeclarado: boolean;
  identityBound: boolean;
  hasEmail: boolean;
  phraseBackedUp: boolean;
  deviceMatches: boolean;
  /** False si el usuario quitó el número en Ajustes. */
  phoneActive?: boolean;
  /** Lectura de `kycExigido()`. Sin el campo, Real sigue pidiendo KYC. */
  kycExigido?: boolean;
  /** Lectura de `identidadExigida()`. Sin el campo, Real sigue pidiendo número. */
  identidadExigida?: boolean;
};

/** Cuenta Real: KYC solo si el contrato lo exige. Demo no lo pide. */
export function liveNeedsKyc(demo: boolean, kycDeclarado: boolean, required = true): boolean {
  if (demo || !required) return false;
  return !kycDeclarado;
}

/** Cuenta Real: número activo en la cuenta. Si lo quita, hay que volver a verificar. Demo no lo pide. */
export function liveNeedsPhone(demo: boolean, identityBound: boolean, phoneActive = true): boolean {
  return !demo && !(identityBound && phoneActive);
}

/** Fila de teléfono del hub: hecha solo si el crédito ya no pide número. */
export function livePhoneStepDone(demo: boolean, identityBound: boolean, phoneActive = true): boolean {
  return !liveNeedsPhone(demo, identityBound, phoneActive);
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

/** Con Alta: 4 USDT también en Demo. Sin Alta: solo Real (legado 2 USDT). */
export function liveNeedsAccess(demo: boolean, paidUsd: number, altaPaid = false): boolean {
  if (hasCreditAccess(paidUsd, altaPaid)) return false;
  if (isAltaConfigured()) return true;
  return !demo;
}

export function liveCreditReady(demo: boolean, flags: LiveCreditFlags): boolean {
  const kycRequired = flags.kycExigido !== false;
  const identityRequired = flags.identidadExigida !== false;
  return (
    !liveNeedsPhrase(flags.phraseBackedUp) &&
    !liveNeedsEmail(demo, flags.hasEmail) &&
    (identityRequired
      ? !liveNeedsPhone(demo, flags.identityBound, flags.phoneActive !== false)
      : true) &&
    !liveNeedsKyc(demo, flags.kycDeclarado, kycRequired) &&
    (identityRequired
      ? !liveNeedsDeviceMatch(demo, flags.deviceMatches, Boolean(flags.phoneActive))
      : true)
  );
}

export type LoanGateBannerRow = 'phrase' | 'email' | 'kyc' | 'phone';

/** Correo, número y KYC solo en Real, después del alta. Demo no abre esa verificación. */
export function identityUnlocked(paidUsd: number, altaPaid = false): boolean {
  if (isDemoAccount()) return false;
  return hasCreditAccess(paidUsd, altaPaid);
}

/** En el hub solo quedan los requisitos de préstamo que aún no están confirmados. */
export function loanGateBannerRows(input: {
  phraseDone: boolean;
  accessPaid?: boolean;
  showIdentity: boolean;
  emailDone: boolean;
  kycDone: boolean;
  phoneDone: boolean;
  kycRequired?: boolean;
  phoneRequired?: boolean;
}): LoanGateBannerRow[] {
  const rows: LoanGateBannerRow[] = [];
  if (!input.phraseDone) rows.push('phrase');
  if (!input.accessPaid || !input.showIdentity) return rows;
  if (!input.emailDone) rows.push('email');
  if (input.kycRequired !== false && !input.kycDone) rows.push('kyc');
  if (input.phoneRequired !== false && !input.phoneDone) rows.push('phone');
  return rows;
}

export function liveCreditBlockReason(
  demo: boolean,
  flags: LiveCreditFlags
): 'phrase' | 'email' | 'phone' | 'kyc' | 'device' | null {
  const kycRequired = flags.kycExigido !== false;
  const identityRequired = flags.identidadExigida !== false;
  if (liveNeedsPhrase(flags.phraseBackedUp)) return 'phrase';
  if (liveNeedsEmail(demo, flags.hasEmail)) return 'email';
  if (identityRequired && liveNeedsPhone(demo, flags.identityBound, flags.phoneActive !== false)) return 'phone';
  if (liveNeedsKyc(demo, flags.kycDeclarado, kycRequired)) return 'kyc';
  if (identityRequired && liveNeedsDeviceMatch(demo, flags.deviceMatches, Boolean(flags.phoneActive))) return 'device';
  return null;
}

export function creditNeedsKyc(userInfo: { kycDeclarado: boolean; kycExigido?: boolean }): boolean {
  return liveNeedsKyc(isDemoAccount(), Boolean(userInfo.kycDeclarado), userInfo.kycExigido !== false);
}

export function creditNeedsPhone(
  userInfo: { identityBound: boolean; identidadExigida?: boolean },
  phoneActive = true
): boolean {
  if (userInfo.identidadExigida === false) return false;
  return liveNeedsPhone(isDemoAccount(), Boolean(userInfo.identityBound), phoneActive);
}

export function creditNeedsEmail(hasEmail: boolean): boolean {
  return liveNeedsEmail(isDemoAccount(), hasEmail);
}

export function creditNeedsPhrase(phraseBackedUp: boolean): boolean {
  return liveNeedsPhrase(phraseBackedUp);
}

export function creditNeedsDeviceMatch(
  deviceMatches: boolean,
  phoneActive = false,
  identityRequired = true
): boolean {
  if (!identityRequired) return false;
  return liveNeedsDeviceMatch(isDemoAccount(), deviceMatches, phoneActive);
}

export const CREDIT_ACCESS_LEGACY_USDT = 2;
export const CREDIT_ACCESS_USDT = CREDIT_ALTA_USDT;
/** Legado sin Alta: correo 0,50. Con Alta el sello ya va en los 4. Demo: 0. */
export const CREDIT_VERIFY_EMAIL_USDT = 0.5;
/** Legado sin Alta: celular 0,50. Con Alta el sello ya va en los 4. Demo: 0. */
export const CREDIT_VERIFY_PHONE_USDT = 0.5;

export function accessPayUsdt(): number {
  return isAltaConfigured() ? CREDIT_ALTA_USDT : CREDIT_ACCESS_LEGACY_USDT;
}

export function creditAccessPaidUsd(donatedUsd: number, altaPaid = false): number {
  const donated = Number(donatedUsd);
  const gift = Number.isFinite(donated) && donated > 0 ? donated : 0;
  if (altaPaid) return Math.max(gift, CREDIT_ALTA_USDT);
  return gift;
}

export type VerificationFeeKind = 'email' | 'phone';

/** Con Alta el 1 USDT ya se cobró en el registro. Legado: 0,50+0,50. Demo: 0. */
export function verificationFeeUsdt(kind: VerificationFeeKind, demo = false): number {
  if (demo || isAltaConfigured()) return 0;
  return kind === 'email' ? CREDIT_VERIFY_EMAIL_USDT : CREDIT_VERIFY_PHONE_USDT;
}

export function verificationFeeLabel(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  return amount.toFixed(2);
}

/** Alta nueva = `registroHecho`. Una donación no sustituye el alta. El legado acepta 2. */
export function hasCreditAccess(paidUsd: number, altaPaid = false): boolean {
  if (altaPaid) return true;
  if (isAltaConfigured()) return false;
  const paid = Number(paidUsd);
  if (!Number.isFinite(paid)) return false;
  return paid + 1e-9 >= CREDIT_ACCESS_LEGACY_USDT;
}

/** Con Alta, todo lo donado cuenta. Legado sin Alta: los primeros 2 eran la puerta. */
export function voluntaryDonateUsd(paidUsd: number): number {
  const paid = Number(paidUsd);
  if (!Number.isFinite(paid) || paid <= 0) return 0;
  if (isAltaConfigured()) return paid;
  if (!hasCreditAccess(paid)) return 0;
  return Math.max(0, paid - CREDIT_ACCESS_LEGACY_USDT);
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

/** Con Alta el acceso no pasa por donar. Legado: la primera de 2 USDT era la puerta. */
export function classifyDonationKind(usdAmount: number, isFirstDonation: boolean): 'access' | 'donation' {
  if (isAltaConfigured()) return 'donation';
  const usd = Number(usdAmount);
  if (isFirstDonation && Number.isFinite(usd) && Math.abs(usd - CREDIT_ACCESS_LEGACY_USDT) < 1e-6) {
    return 'access';
  }
  return 'donation';
}

export function creditNeedsAccess(paidUsd: number, altaPaid = false): boolean {
  return liveNeedsAccess(isDemoAccount(), paidUsd, altaPaid);
}

/** Con Alta basta el fundador. Legado: donar + destino + red Real. */
export function canPayCreditAccess(input: {
  protocolCanDonate: boolean;
  founderAddress: string;
  accessEnabled: boolean;
  altaReady?: boolean;
}): boolean {
  const dest = Boolean(String(input.founderAddress || '').trim());
  if (input.altaReady || isAltaConfigured()) return dest;
  return Boolean(input.protocolCanDonate && dest && input.accessEnabled);
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

/** Baldosa Admin: sesión externa + rol, o la dirección está en el roster ya leído. */
export function adminSeatOpen(input: {
  demo: boolean;
  connected: boolean;
  address?: string | null;
  isAdmin?: boolean;
  isOwner?: boolean;
  roster?: string[];
}): boolean {
  if (!input.demo || !input.connected) return false;
  if (input.isAdmin || input.isOwner) return true;
  const wallet = String(input.address || '').trim().toLowerCase();
  if (!wallet) return false;
  return (input.roster || []).some((item) => String(item || '').toLowerCase() === wallet);
}

export function identityHashBound(value: string | null | undefined): boolean {
  const hash = String(value || '');
  return Boolean(hash) && !/^0x0+$/i.test(hash);
}
