import { Contract, ZeroAddress, isAddress } from 'ethers';
import { CONTRACT_ABI, getContractAddress } from '../constants/contractConfig';
import { getProviderWithFallback, isContractConfigured } from '../constants/rpcConfig';
import { restoreMatchesDevice } from '../utils/accountEntry';
import { getBoundWallet, getDeviceHash } from './deviceBinding';

function withLimit<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
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

/** Billetera ya atada a este dispositivo on-chain. Vacío si este aparato está libre. */
export async function lookupBoundWalletOnThisDevice(): Promise<string> {
  if (!isContractConfigured()) return '';
  try {
    const hash = await getDeviceHash();
    const provider = getProviderWithFallback();
    const credit = new Contract(getContractAddress(), CONTRACT_ABI, provider);
    const wallet = String(
      await withLimit(credit.walletOfDevice(hash) as Promise<string>, 4000, '')
    ).toLowerCase();
    if (!isAddress(wallet) || wallet === ZeroAddress.toLowerCase()) return '';
    return wallet;
  } catch {
    return '';
  }
}

export async function lookupDeviceHashOf(wallet: string): Promise<string> {
  if (!isContractConfigured() || !isAddress(wallet)) return '';
  try {
    const provider = getProviderWithFallback();
    const credit = new Contract(getContractAddress(), CONTRACT_ABI, provider);
    return String(await withLimit(credit.deviceHashOf(wallet) as Promise<string>, 4000, ''));
  } catch {
    return '';
  }
}

/** Bloquea traer otra billetera a un dispositivo que ya tiene dueño. */
export async function assertRestoreFitsThisDevice(phraseWallet: string): Promise<void> {
  const next = String(phraseWallet || '').toLowerCase();
  const localBound = await getBoundWallet();
  if (localBound && localBound !== next) {
    throw new Error('device-bound');
  }
  const claimed = await lookupBoundWalletOnThisDevice();
  if (!restoreMatchesDevice(claimed, next)) {
    throw new Error('wallet-other-app');
  }
}
