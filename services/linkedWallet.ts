import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAddress, isAddress } from 'ethers';
import { storeSlot } from '../utils/storeSlot';

const PREFIX = `${storeSlot(['quatrivium', 'linkedExternal', 'v1'])}:`;
export const WALLET_LINK_SKIPPED = 'skipped';

export function linkedWalletStorageKey(internalWallet: string): string {
  return `${PREFIX}${String(internalWallet || '').trim().toLowerCase()}`;
}

export function hasLinkedExternalWallet(value: string): boolean {
  const address = String(value || '').trim();
  return isAddress(address) && !/^0x0+$/i.test(address);
}

export function hasCompletedWalletLink(value: string): boolean {
  return String(value || '').trim() === WALLET_LINK_SKIPPED || hasLinkedExternalWallet(value);
}

export async function loadLinkedExternalWallet(internalWallet: string): Promise<string> {
  if (!isAddress(internalWallet)) return '';
  try {
    const stored = String((await AsyncStorage.getItem(linkedWalletStorageKey(internalWallet))) || '').trim();
    if (stored === WALLET_LINK_SKIPPED) return WALLET_LINK_SKIPPED;
    return hasLinkedExternalWallet(stored) ? getAddress(stored) : '';
  } catch {
    return '';
  }
}

export async function saveLinkedExternalWallet(
  internalWallet: string,
  externalWallet: string
): Promise<string> {
  if (!internalWallet || !hasLinkedExternalWallet(externalWallet)) {
    throw new Error('wallet');
  }
  const address = getAddress(externalWallet);
  await AsyncStorage.setItem(linkedWalletStorageKey(internalWallet), address);
  return address;
}

export async function skipLinkedExternalWallet(internalWallet: string): Promise<string> {
  if (!isAddress(internalWallet)) throw new Error('wallet');
  await AsyncStorage.setItem(linkedWalletStorageKey(internalWallet), WALLET_LINK_SKIPPED);
  return WALLET_LINK_SKIPPED;
}

export async function loadRequiredExternalWallet(internalWallet: string): Promise<string> {
  const stored = await loadLinkedExternalWallet(internalWallet);
  return hasLinkedExternalWallet(stored) ? stored : '';
}
