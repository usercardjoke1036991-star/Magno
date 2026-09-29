import * as SecureStore from 'expo-secure-store';
import { NOTIFY_API } from '../constants/appLinks';
import { isValidUsername, normalizeUsername } from '../utils/usernamePolicy';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { storeSlot } from '../utils/storeSlot';

const KEY = storeSlot(['quatrivium', 'account', 'username']);
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function loadClaimedUsername(): Promise<string> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const username = normalizeUsername(raw || '');
    return isValidUsername(username) ? username : '';
  } catch {
    return '';
  }
}

export async function saveClaimedUsername(username: string): Promise<string> {
  const next = normalizeUsername(username);
  if (!isValidUsername(next)) {
    throw new Error('username');
  }
  await SecureStore.setItemAsync(KEY, next, OPTIONS);
  return next;
}

async function signedUsernameBody(walletAddress: string, username: string) {
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  return signedAuthBody(signer, walletAddress, 'username', { phone: username });
}

export async function checkUsernameAvailable(walletAddress: string, username: string): Promise<boolean> {
  const next = normalizeUsername(username);
  if (!isValidUsername(next)) return false;
  if (!NOTIFY_API) return true;
  const response = await safeJsonFetch(`${NOTIFY_API}/username/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedUsernameBody(walletAddress, next)),
  });
  if (response.status === 409) return false;
  if (!response.ok) {
    let message = 'username-check';
    try {
      const body = await readJsonLimited<{ error?: string }>(response);
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const body = await readJsonLimited<{ available?: boolean }>(response);
  return body.available !== false;
}

export async function claimUsername(walletAddress: string, username: string): Promise<string> {
  const next = normalizeUsername(username);
  if (!isValidUsername(next)) throw new Error('username');
  if (NOTIFY_API) {
    const response = await safeJsonFetch(`${NOTIFY_API}/username/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await signedUsernameBody(walletAddress, next)),
    });
    if (!response.ok) {
      let message = 'username-claim';
      try {
        const body = await readJsonLimited<{ error?: string }>(response);
        if (body.error) message = body.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
  }
  return saveClaimedUsername(next);
}

export async function clearClaimedUsername(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
