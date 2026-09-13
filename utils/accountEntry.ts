import { isValidEmail, normalizeEmail } from './emailPolicy';
import { isValidMasterPassword } from './passwordPolicy';
import { isValidUsername, normalizeUsername } from './usernamePolicy';

export function canSubmitCreateSecrets(password: string, email: string): boolean {
  return isValidMasterPassword(password) && isValidEmail(normalizeEmail(email));
}

export function canSubmitDeviceCredentials(password: string, username: string): boolean {
  return isValidMasterPassword(password) && isValidUsername(username);
}

export function canSubmitCreateCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function canSubmitSignIn(password: string, username: string): boolean {
  return Boolean(password) && isValidUsername(username);
}

export function signInEmailMatches(typed: string, saved: string): boolean {
  const left = normalizeEmail(typed);
  const right = normalizeEmail(saved);
  return Boolean(right) && left === right;
}

export function signInEmailAllowed(typed: string, saved: string): boolean {
  if (!isValidEmail(normalizeEmail(typed))) return false;
  if (!normalizeEmail(saved)) return true;
  return signInEmailMatches(typed, saved);
}

/** Crear cuenta solo si este teléfono aún no tiene una y el dispositivo no está ya atado. */
export function welcomeShowsCreate(accountOnPhone: boolean, deviceClaimed = false): boolean {
  return !accountOnPhone && !deviceClaimed;
}

export function welcomeShowsSignIn(_accountOnPhone: boolean): boolean {
  return false;
}

export type EntryScreen = 'welcome' | 'signIn' | 'unlock' | 'app';

/** SecureStore/MIUI: true hay cuenta, false vacío, null no se pudo leer. */
export function accountOnPhoneFromProbes(
  password: boolean | null,
  pin: boolean | null
): boolean | null {
  if (password === true || pin === true) return true;
  if (password === null || pin === null) return null;
  return false;
}

/** Tras Guardar sesión no se vuelve a crear/iniciar/recuperar. */
export function nextEntryScreen(input: {
  accountOnPhone: boolean | null;
  sessionSaved: boolean;
  wrapReady: boolean;
  unlockOn: boolean;
}): EntryScreen {
  if (input.accountOnPhone === null) return 'signIn';
  if (!input.accountOnPhone) return 'welcome';
  if (!input.sessionSaved) return 'signIn';
  if (input.unlockOn) return 'unlock';
  if (input.wrapReady) return 'app';
  return 'unlock';
}

export function welcomeActions(
  accountOnPhone: boolean,
  deviceClaimed = false
): Array<'createPhrase' | 'restoreAccount'> {
  if (accountOnPhone) return [];
  if (deviceClaimed) return ['restoreAccount'];
  return ['createPhrase', 'restoreAccount'];
}

export function restoreMatchesDevice(claimedWallet: string, phraseWallet: string): boolean {
  const claimed = String(claimedWallet || '').toLowerCase();
  const phrase = String(phraseWallet || '').toLowerCase();
  if (!claimed || claimed === '0x0000000000000000000000000000000000000000') return true;
  return Boolean(phrase) && claimed === phrase;
}

export function walletRunsOnThisDevice(onChainDeviceHash: string, localDeviceHash: string): boolean {
  const bound = String(onChainDeviceHash || '');
  if (!bound || /^0x0+$/i.test(bound)) return true;
  return bound.toLowerCase() === String(localDeviceHash || '').toLowerCase();
}

/** Recuperar en este aparato: si el dispositivo ya tiene dueño, solo esa billetera. */
export function restoreAllowedOnThisDevice(input: {
  claimedWallet: string;
  phraseWallet: string;
  onChainDeviceHash?: string;
  localDeviceHash?: string;
}): boolean {
  if (!restoreMatchesDevice(input.claimedWallet, input.phraseWallet)) return false;
  if (input.onChainDeviceHash == null || input.localDeviceHash == null) return true;
  return walletRunsOnThisDevice(input.onChainDeviceHash, input.localDeviceHash);
}

/** El primero es el principal. Si no hay ninguno, contraseña. */
export function orderUnlockMethods(selected: readonly string[], primary?: string): string[] {
  const unique = [...new Set((selected || []).filter(Boolean))];
  if (!unique.length) return ['password'];
  const head = primary && unique.includes(primary) ? primary : unique[0];
  return [head, ...unique.filter((method) => method !== head)];
}

/** Solo la principal, o todas como opciones. */
export function unlockPromptMethods(
  selected: readonly string[],
  primary: string | undefined,
  primaryOnly: boolean
): string[] {
  const ordered = orderUnlockMethods(selected, primary);
  return primaryOnly ? [ordered[0]] : ordered;
}

/** La app no ofrece destruir ni generar otra cuenta. */
export function appOffersDestroyAccount(): boolean {
  return false;
}

/** Cambiar de red o VPN no crea otra cuenta. */
export function networkChangeCreatesAccount(): boolean {
  return false;
}

/** Tras formatear, el mismo teléfono o dispositivo on-chain no abre otra línea Real. */
export function liveSecondCreditAllowed(flags: { phoneTaken: boolean; deviceTaken: boolean }): boolean {
  return !flags.phoneTaken && !flags.deviceTaken;
}

export function signInUsernameMatches(typed: string, saved: string): boolean {
  const left = normalizeUsername(typed);
  const right = normalizeUsername(saved);
  return Boolean(right) && left === right;
}

export function signInUsernameAllowed(typed: string, saved: string): boolean {
  if (!isValidUsername(typed)) return false;
  if (!normalizeUsername(saved)) return true;
  return signInUsernameMatches(typed, saved);
}

/** Si no hay dueño, este aparato puede reclamar. Si hay dueño, solo el mismo hash. */
export function sessionOwnedHere(claimedDeviceHash: string, localDeviceHash: string): boolean {
  const claimed = String(claimedDeviceHash || '').toLowerCase();
  const local = String(localDeviceHash || '').toLowerCase();
  if (!claimed || /^0x0+$/i.test(claimed)) return true;
  return Boolean(local) && claimed === local;
}

export function canSubmitReinstall(phrase: string, password: string, username: string): boolean {
  return canSubmitRestorePhrase(phrase) && canSubmitDeviceCredentials(password, username);
}

export function canSubmitRestorePhrase(phrase: string): boolean {
  const words = String(phrase || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return words.length === 12 || words.length === 24;
}
