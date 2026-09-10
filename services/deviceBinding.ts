import { keccak256, toUtf8Bytes } from 'ethers';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const INSTALL_KEY = 'quatrivium.device.installId';
const BOUND_WALLET_KEY = 'quatrivium.device.boundWallet';
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export type DeviceClaim = { ok: true; wallet: string } | { ok: false; bound: string };

async function hardwareSeed(): Promise<string> {
  try {
    if (Platform.OS === 'android' && typeof Application.getAndroidId === 'function') {
      return String(Application.getAndroidId() || '');
    }
    if (Platform.OS === 'ios' && typeof Application.getIosIdForVendorAsync === 'function') {
      return (await Application.getIosIdForVendorAsync()) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

async function installSeed(): Promise<string> {
  const existing = await SecureStore.getItemAsync(INSTALL_KEY);
  if (existing) return existing;
  const next = Crypto.randomUUID();
  await SecureStore.setItemAsync(INSTALL_KEY, next, OPTIONS);
  return next;
}

export async function getDeviceHash(): Promise<string> {
  const hardware = await hardwareSeed();
  const install = await installSeed();
  const seed = hardware || install;
  return keccak256(toUtf8Bytes(`quatrivium:${seed}`));
}

export async function getBoundWallet(): Promise<string> {
  try {
    return ((await SecureStore.getItemAsync(BOUND_WALLET_KEY)) || '').toLowerCase();
  } catch {
    return '';
  }
}

export async function bindAppWallet(address: string): Promise<void> {
  const next = address.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(next)) return;
  await SecureStore.setItemAsync(BOUND_WALLET_KEY, next, OPTIONS);
}

export async function clearBoundWallet(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BOUND_WALLET_KEY);
  } catch {
    // ignore
  }
}

export async function claimDeviceWallet(address: string): Promise<DeviceClaim> {
  const next = address.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(next)) {
    return { ok: false, bound: '' };
  }
  const bound = await getBoundWallet();
  if (!bound) {
    await SecureStore.setItemAsync(BOUND_WALLET_KEY, next, OPTIONS);
    return { ok: true, wallet: next };
  }
  if (bound === next) {
    return { ok: true, wallet: next };
  }
  return { ok: false, bound };
}
