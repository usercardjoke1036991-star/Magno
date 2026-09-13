import { isDemoAccount } from '../constants/rpcConfig';

export type LiveCreditFlags = {
  kycDeclarado: boolean;
  identityBound: boolean;
  hasEmail: boolean;
  phraseBackedUp: boolean;
  deviceMatches: boolean;
};

/** Cuenta Real: KYC obligatorio antes de pedir. Demo no lo pide. */
export function liveNeedsKyc(demo: boolean, kycDeclarado: boolean): boolean {
  return !demo && !kycDeclarado;
}

/** Cuenta Real: teléfono y dispositivo on-chain. Demo no lo pide. */
export function liveNeedsPhone(demo: boolean, identityBound: boolean): boolean {
  return !demo && !identityBound;
}

/** Cuenta Real: correo de la cuenta en este teléfono. Demo no lo pide. */
export function liveNeedsEmail(demo: boolean, hasEmail: boolean): boolean {
  return !demo && !hasEmail;
}

/** Anotar las 12 palabras antes de pedir crédito. Demo y Real. */
export function liveNeedsPhrase(phraseBackedUp: boolean): boolean {
  return !phraseBackedUp;
}

/** Cuenta Real: la billetera solo opera en el dispositivo donde se ató. */
export function liveNeedsDeviceMatch(demo: boolean, deviceMatches: boolean): boolean {
  return !demo && !deviceMatches;
}

export function liveCreditReady(demo: boolean, flags: LiveCreditFlags): boolean {
  return (
    !liveNeedsPhrase(flags.phraseBackedUp) &&
    !liveNeedsEmail(demo, flags.hasEmail) &&
    !liveNeedsPhone(demo, flags.identityBound) &&
    !liveNeedsKyc(demo, flags.kycDeclarado) &&
    !liveNeedsDeviceMatch(demo, flags.deviceMatches)
  );
}

export function liveCreditBlockReason(
  demo: boolean,
  flags: LiveCreditFlags
): 'phrase' | 'email' | 'phone' | 'kyc' | 'device' | null {
  if (liveNeedsPhrase(flags.phraseBackedUp)) return 'phrase';
  if (liveNeedsEmail(demo, flags.hasEmail)) return 'email';
  if (liveNeedsPhone(demo, flags.identityBound)) return 'phone';
  if (liveNeedsKyc(demo, flags.kycDeclarado)) return 'kyc';
  if (liveNeedsDeviceMatch(demo, flags.deviceMatches)) return 'device';
  return null;
}

export function creditNeedsKyc(userInfo: { kycDeclarado: boolean }): boolean {
  return liveNeedsKyc(isDemoAccount(), Boolean(userInfo.kycDeclarado));
}

export function creditNeedsPhone(userInfo: { identityBound: boolean }): boolean {
  return liveNeedsPhone(isDemoAccount(), Boolean(userInfo.identityBound));
}

export function creditNeedsEmail(hasEmail: boolean): boolean {
  return liveNeedsEmail(isDemoAccount(), hasEmail);
}

export function creditNeedsPhrase(phraseBackedUp: boolean): boolean {
  return liveNeedsPhrase(phraseBackedUp);
}

export function creditNeedsDeviceMatch(deviceMatches: boolean): boolean {
  return liveNeedsDeviceMatch(isDemoAccount(), deviceMatches);
}

export function identityHashBound(value: string | null | undefined): boolean {
  const hash = String(value || '');
  return Boolean(hash) && !/^0x0+$/i.test(hash);
}
