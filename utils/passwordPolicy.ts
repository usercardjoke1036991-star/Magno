export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 66;
/** Tope del campo; la longitud la elige el usuario (8–66). */
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
  if (!/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) return 'weak';
  if (/^(.)\1+$/.test(value)) return 'weak';
  if (new Set(value).size < 4) return 'weak';
  return null;
}

export function isValidMasterPassword(value: string): boolean {
  return masterPasswordReject(value) === null;
}

export function masterPasswordFromRandomBytes(bytes: Uint8Array): string {
  const max = 256 - (256 % PASSWORD_ALPHABET.length);
  let pool = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const unit = bytes[i];
    if (unit >= max) continue;
    pool += PASSWORD_ALPHABET[unit % PASSWORD_ALPHABET.length];
  }
  if (pool.length < 12) throw new Error('entropy');
  const classes = ['A', '7', '#', 'b'];
  const rest = pool.slice(0, 12);
  return `${classes[0]}${classes[3]}${classes[1]}${classes[2]}${rest}`.slice(0, 16);
}
