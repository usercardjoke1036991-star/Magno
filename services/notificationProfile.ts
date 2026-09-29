import * as SecureStore from 'expo-secure-store';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { NOTIFY_API } from '../constants/appLinks';
import { stripUnsafeText } from '../utils/sanitize';
import { safeJsonFetch } from '../utils/safeFetch';
import { storeSlot } from '../utils/storeSlot';

const STORAGE_KEY = storeSlot(['quatrivium', 'notify', 'profile']);

export interface NotificationPrefs {
  debt: boolean;
  commission: boolean;
  signup: boolean;
  email: boolean;
}

export interface NotificationProfile {
  phone: string;
  whatsapp: string;
  telegramUsername: string;
  prefs: NotificationPrefs;
}

const DEFAULT_PROFILE: NotificationProfile = {
  phone: '',
  whatsapp: '',
  telegramUsername: '',
  prefs: { debt: true, commission: false, signup: false, email: true },
};

const digitsOnly = (value: string) => value.replace(/[^\d+]/g, '');

export function normalizePhone(value: string): string {
  const trimmed = digitsOnly(value.trim());
  if (!trimmed) return '';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

export function isValidPhone(value: string): boolean {
  if (!value) return true;
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
}

export async function loadNotificationProfile(): Promise<NotificationProfile> {
  try {
    const raw =
      (await SecureStore.getItemAsync(STORAGE_KEY)) ||
      (await SecureStore.getItemAsync('bitcredit.notify.profile'));
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as NotificationProfile;
    const next = {
      ...DEFAULT_PROFILE,
      ...parsed,
      prefs: {
        ...DEFAULT_PROFILE.prefs,
        ...parsed.prefs,
        debt: true,
        email: parsed.prefs?.email !== false,
      },
    };
    if (!(await SecureStore.getItemAsync(STORAGE_KEY))) {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
      try {
        await SecureStore.deleteItemAsync('bitcredit.notify.profile');
      } catch {
        // ignore
      }
    }
    return next;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveNotificationProfile(
  walletAddress: string,
  profile: NotificationProfile
): Promise<NotificationProfile> {
  const next: NotificationProfile = {
    phone: normalizePhone(profile.phone),
    whatsapp: normalizePhone(profile.whatsapp || profile.phone),
    telegramUsername: stripUnsafeText(profile.telegramUsername.replace(/^@/, ''), 32),
    prefs: profile.prefs,
  };

  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));

  if (NOTIFY_API && walletAddress) {
    try {
      const signer = await loadAppWallet();
      if (!signer) throw new Error('appWalletNotReady');
      const auth = await signedAuthBody(signer, walletAddress, 'vincular-avisos');
      await safeJsonFetch(`${NOTIFY_API}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...auth,
          contactPhone: next.phone,
          whatsapp: next.whatsapp,
          telegramUsername: next.telegramUsername,
          prefs: next.prefs,
        }),
      });
    } catch {
      // El perfil queda guardado en el dispositivo aunque el servicio no esté activo.
    }
  }

  return next;
}
