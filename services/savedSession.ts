import * as SecureStore from 'expo-secure-store';
import { isAuthEnabled } from './authPrefs';
import { getWalletWrapKey, setWalletWrapKey } from './walletSession';

const FLAG = 'qc_session_saved_v1';
const WRAP = 'qc_session_wrap_v1';
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function isSessionSaved(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(FLAG)) === '1';
  } catch {
    return false;
  }
}

export async function purgePersistedWrap(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(WRAP);
  } catch {
    // ignore
  }
}

export async function markSessionSaved(): Promise<void> {
  await SecureStore.setItemAsync(FLAG, '1', OPTIONS);
  const wrap = getWalletWrapKey();
  // Si el desbloqueo está on, la wrap se deriva al desbloquear. No dejarla suelta en el almacén.
  if (wrap && !(await isAuthEnabled('unlock'))) {
    await SecureStore.setItemAsync(WRAP, wrap, OPTIONS);
    return;
  }
  await purgePersistedWrap();
}

export async function restoreSavedSessionWrap(): Promise<boolean> {
  if (!(await isSessionSaved())) return false;
  if (await isAuthEnabled('unlock')) return false;
  try {
    const raw = await SecureStore.getItemAsync(WRAP);
    if (!raw) return false;
    setWalletWrapKey(raw);
    return Boolean(getWalletWrapKey());
  } catch {
    return false;
  }
}

export async function clearSavedSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(FLAG);
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(WRAP);
  } catch {
    // ignore
  }
}
