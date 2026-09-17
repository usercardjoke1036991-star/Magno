import * as SecureStore from 'expo-secure-store';
import {
  buildLockedSponsor,
  parseLockedSponsor,
  sponsorLockKey,
  type LockedSponsor,
} from '../utils/sponsorLock';

const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export type { LockedSponsor };

export async function loadLockedSponsor(wallet: string): Promise<LockedSponsor | null> {
  const address = String(wallet || '').trim();
  if (!address) return null;
  try {
    const raw = await SecureStore.getItemAsync(sponsorLockKey(address));
    return parseLockedSponsor(raw);
  } catch {
    return null;
  }
}

/** Fija el padrino una sola vez. Si ya está bloqueado, ignora el valor nuevo. */
export async function lockSponsorOnce(wallet: string, raw = ''): Promise<LockedSponsor> {
  const address = String(wallet || '').trim();
  if (!address) throw new Error('wallet');
  const existing = await loadLockedSponsor(address);
  if (existing) return existing;
  const next = buildLockedSponsor(raw, address);
  await SecureStore.setItemAsync(sponsorLockKey(address), JSON.stringify(next), OPTIONS);
  return next;
}
