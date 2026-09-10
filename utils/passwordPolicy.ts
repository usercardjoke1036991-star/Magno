export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
/** Tope del campo; la longitud la elige el usuario. */
export const PASSWORD_LENGTH = PASSWORD_MAX;
/** Sin 0/O/1/l/I para que se pueda copiar a mano sin confusiones. */
export const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';

export function isPrivateKeyPassword(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

export type PasswordReject = 'length' | 'charset' | 'weak' | 'private-key';

export function masterPasswordReject(value: string): PasswordReject | null {
  if (isPrivateKeyPassword(value)) return 'private-key';
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) return 'length';
  if (!/^[\x21-\x7E]+$/.test(value)) return 'charset';
  if (/^(.)\1+$/.test(value)) return 'weak';
  if (new Set(value).size < 4) return 'weak';
  return null;
}

export function isValidMasterPassword(value: string): boolean {
  return masterPasswordReject(value) === null;
}

export function masterPasswordFromRandomBytes(bytes: Uint8Array): string {
  const max = 256 - (256 % PASSWORD_ALPHABET.length);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const unit = bytes[i];
    if (unit >= max) continue;
    out += PASSWORD_ALPHABET[unit % PASSWORD_ALPHABET.length];
    if (out.length === 16) return out;
  }
  throw new Error('entropy');
}
