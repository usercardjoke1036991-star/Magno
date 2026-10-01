import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getProductMode } from '../constants/rpcConfig';
import { isValidEmail, normalizeEmail } from '../utils/emailPolicy';
import { storeSlot } from '../utils/storeSlot';
import { allowWalletAsyncFallback } from '../utils/walletVaultPolicy';

const KEY = storeSlot(['quatrivium', 'account', 'email']);
const FALLBACK = storeSlot(['quatrivium', 'account', 'email', 'fallback']);
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

function parseEmail(raw: string | null): string {
  const email = normalizeEmail(raw || '');
  return isValidEmail(email) ? email : '';
}

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

export async function loadVerifiedEmail(): Promise<string> {
  const secure = parseEmail(await withLimit(SecureStore.getItemAsync(KEY).catch(() => null), 1500, null));
  if (secure) return secure;
  if (!allowWalletAsyncFallback(getProductMode())) return '';
  return parseEmail(await AsyncStorage.getItem(FALLBACK).catch(() => null));
}

export async function isEmailVerified(): Promise<boolean> {
  return Boolean(await loadVerifiedEmail());
}

export async function saveVerifiedEmail(email: string): Promise<string> {
  const next = normalizeEmail(email);
  if (!isValidEmail(next)) {
    throw new Error('email');
  }
  if (allowWalletAsyncFallback(getProductMode())) {
    await AsyncStorage.setItem(FALLBACK, next).catch(() => {});
  } else {
    await AsyncStorage.removeItem(FALLBACK).catch(() => {});
  }
  await withLimit(SecureStore.setItemAsync(KEY, next, OPTIONS).then(() => true), 2500, false);
  return next;
}

export async function clearVerifiedEmail(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FALLBACK);
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
