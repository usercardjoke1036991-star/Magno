import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getProductMode } from '../constants/rpcConfig';
import { storeSlot } from '../utils/storeSlot';
import { allowWalletAsyncFallback } from '../utils/walletVaultPolicy';
import { isValidPhone, normalizePhone } from './notificationProfile';

const PHONE_KEY = storeSlot(['quatrivium', 'account', 'phone']);
const PHONE_FALLBACK = storeSlot(['quatrivium', 'account', 'phone', 'fallback']);
const ACTIVE_KEY = storeSlot(['quatrivium', 'account', 'phone', 'active']);
const ACTIVE_FALLBACK = storeSlot(['quatrivium', 'account', 'phone', 'active', 'fallback']);
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function withLimit<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

function parsePhone(raw: string | null): string {
  const phone = normalizePhone(raw || '');
  return phone && isValidPhone(phone) ? phone : '';
}

export function maskPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6) return '';
  return `+${digits.slice(0, 2)}•••${digits.slice(-4)}`;
}

export async function loadVerifiedPhone(): Promise<string> {
  const secure = parsePhone(await withLimit(SecureStore.getItemAsync(PHONE_KEY).catch(() => null), 1500, null));
  if (secure) return secure;
  if (!allowWalletAsyncFallback(getProductMode())) return '';
  return parsePhone(await AsyncStorage.getItem(PHONE_FALLBACK).catch(() => null));
}

export async function saveVerifiedPhone(phone: string): Promise<string> {
  const next = normalizePhone(phone);
  if (!next || !isValidPhone(next)) {
    throw new Error('phone');
  }
  if (allowWalletAsyncFallback(getProductMode())) {
    await AsyncStorage.setItem(PHONE_FALLBACK, next).catch(() => {});
  } else {
    await AsyncStorage.removeItem(PHONE_FALLBACK).catch(() => {});
  }
  await withLimit(SecureStore.setItemAsync(PHONE_KEY, next, OPTIONS).then(() => true), 2500, false);
  await setPhoneActive(true);
  return next;
}

export async function clearVerifiedPhone(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PHONE_FALLBACK);
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(PHONE_KEY);
  } catch {
    // ignore
  }
}

async function loadActiveFlag(): Promise<string> {
  const secure = String(
    (await withLimit(SecureStore.getItemAsync(ACTIVE_KEY).catch(() => null), 1500, null)) || ''
  ).trim();
  if (secure === '0' || secure === '1') return secure;
  const fallback = String((await AsyncStorage.getItem(ACTIVE_FALLBACK).catch(() => null)) || '').trim();
  return fallback === '0' || fallback === '1' ? fallback : '';
}

export async function setPhoneActive(active: boolean): Promise<void> {
  const value = active ? '1' : '0';
  if (allowWalletAsyncFallback(getProductMode())) {
    await AsyncStorage.setItem(ACTIVE_FALLBACK, value).catch(() => {});
  } else {
    await AsyncStorage.removeItem(ACTIVE_FALLBACK).catch(() => {});
  }
  await withLimit(SecureStore.setItemAsync(ACTIVE_KEY, value, OPTIONS).then(() => true), 2500, false);
  if (!active) await clearVerifiedPhone();
}

/** Si nunca se guardó el flag, no se bloquea a cuentas antiguas. Tras quitar el número queda en 0. */
export async function isPhoneActive(): Promise<boolean> {
  const flag = await loadActiveFlag();
  if (flag === '0') return false;
  if (flag === '1') return true;
  return true;
}

export async function isPhoneVerified(): Promise<boolean> {
  if (!(await isPhoneActive())) return false;
  return Boolean(await loadVerifiedPhone());
}
