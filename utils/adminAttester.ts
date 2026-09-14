import { getAddress, isAddress, ZeroAddress } from 'ethers';

export type AttesterProposalError = 'key' | 'address' | 'role';

function normalize(value: string): string {
  return String(value || '').trim();
}

/** Clave privada de 32 bytes. El panel solo admite la dirección 0x. */
export function looksLikePrivateKey(value: string): boolean {
  const raw = normalize(value).replace(/^0x/i, '');
  return /^[0-9a-fA-F]{64}$/.test(raw);
}

function sameAddress(a: string, b: string): boolean {
  if (!isAddress(a) || !isAddress(b)) return false;
  return getAddress(a) === getAddress(b);
}

/**
 * Misma regla que el contrato (`setAttester`) más el producto:
 * el sello no es owner ni fundadora. Nunca una clave privada.
 */
export function attesterProposalError(
  value: string,
  ownerAddress: string,
  blockedAddresses: string[]
): AttesterProposalError | null {
  const trimmed = normalize(value);
  if (looksLikePrivateKey(trimmed)) return 'key';
  if (!isAddress(trimmed) || sameAddress(trimmed, ZeroAddress)) return 'address';
  if (ownerAddress && sameAddress(trimmed, ownerAddress)) return 'role';
  if ((blockedAddresses || []).some((item) => sameAddress(trimmed, item))) return 'role';
  return null;
}
