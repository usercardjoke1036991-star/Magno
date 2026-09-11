import { isDemoMode } from '../constants/rpcConfig';

export function creditNeedsKyc(userInfo: { kycExigido: boolean; kycDeclarado: boolean }): boolean {
  if (isDemoMode()) return false;
  return Boolean(userInfo.kycExigido) && !userInfo.kycDeclarado;
}

export function creditNeedsPhone(userInfo: { identidadExigida: boolean; identityBound: boolean }): boolean {
  if (isDemoMode()) return false;
  return Boolean(userInfo.identidadExigida) && !userInfo.identityBound;
}
