import * as SecureStore from 'expo-secure-store';
import { isValidEmail, normalizeEmail } from '../utils/emailPolicy';

const KEY = 'quatrivium.account.email';
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function loadVerifiedEmail(): Promise<string> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const email = normalizeEmail(raw || '');
    return isValidEmail(email) ? email : '';
  } catch {
    return '';
  }
}

export async function isEmailVerified(): Promise<boolean> {
  return Boolean(await loadVerifiedEmail());
}

export async function saveVerifiedEmail(email: string): Promise<string> {
  const next = normalizeEmail(email);
  if (!isValidEmail(next)) {
    throw new Error('email');
  }
  await SecureStore.setItemAsync(KEY, next, OPTIONS);
  return next;
}

export async function clearVerifiedEmail(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
