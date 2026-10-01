import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAddress, isAddress, type Eip1193Provider } from 'ethers';
import { storeSlot } from '../utils/storeSlot';
import { signBindExternalWallet } from './walletAuth';
import { getEthersSignerFromProvider } from '../web3Config';

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

/** Pide EIP-712 en la billetera externa y solo entonces guarda la address. */
export async function proveAndSaveLinkedWallet(
  eip1193: Eip1193Provider | null | undefined,
  internalWallet: string,
  externalWallet: string
): Promise<string> {
  if (!eip1193) throw new Error('signer');
  const signer = await getEthersSignerFromProvider(eip1193);
  if (!signer) throw new Error('signer');
  const from = getAddress(await signer.getAddress());
  const external = getAddress(externalWallet);
  if (from !== external) throw new Error('wallet');
  await signBindExternalWallet(signer, internalWallet, external);
  return saveLinkedExternalWallet(internalWallet, external);
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
