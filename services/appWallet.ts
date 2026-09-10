import { Contract, HDNodeWallet, JsonRpcProvider, Mnemonic, Wallet, type Signer } from 'ethers';
import * as SecureStore from 'expo-secure-store';
import { ERC20_ABI } from '../constants/contractConfig';
import { NETWORK_CONFIG, RPC_URLS } from '../constants/rpcConfig';
import { estimateNetworkGasWei, resolveFeeCollector } from '../constants/feeConfig';
import { isAllowedWei, isHexAddress } from '../utils/sanitize';
import { isSealedBlob, openSecret, sealSecret } from '../utils/secretBox';
import { bindAppWallet, claimDeviceWallet, clearBoundWallet, getBoundWallet } from './deviceBinding';
import { getWalletWrapKey } from './walletSession';

const WALLET_KEY = 'quatrivium.appWallet.v1';
const PHRASE_ACK_KEY = 'quatrivium.appWallet.phraseAck';
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

interface StoredWallet {
  address: string;
  privateKey: string;
  mnemonic?: string;
}

function parseStored(raw: string): StoredWallet | null {
  try {
    const parsed = JSON.parse(raw) as StoredWallet;
    if (!isHexAddress(parsed.address) || !parsed.privateKey?.startsWith('0x')) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readStored(): Promise<StoredWallet | null> {
  const raw = await SecureStore.getItemAsync(WALLET_KEY);
  if (!raw) return null;
  if (isSealedBlob(raw)) {
    const wrap = getWalletWrapKey();
    if (!wrap) return null;
    return parseStored(openSecret(raw, wrap));
  }
  const parsed = parseStored(raw);
  if (!parsed) return null;
  const wrap = getWalletWrapKey();
  if (!wrap) return null;
  await persistRecord(parsed);
  return parsed;
}

async function persistRecord(record: StoredWallet): Promise<void> {
  const wrap = getWalletWrapKey();
  if (!wrap) {
    throw new Error('locked');
  }
  const sealed = sealSecret(JSON.stringify(record), wrap);
  await SecureStore.setItemAsync(WALLET_KEY, sealed, OPTIONS);
}

async function writeStored(record: StoredWallet): Promise<void> {
  const claim = await claimDeviceWallet(record.address);
  if (!claim.ok) {
    throw new Error('device-bound');
  }
  await persistRecord(record);
  await bindAppWallet(record.address);
}

export async function rewrapWalletWithNewKey(rotatePin: () => Promise<string>): Promise<void> {
  const current = await readStored();
  await rotatePin();
  if (current) {
    await persistRecord(current);
  }
}

function writeProvider() {
  return new JsonRpcProvider(
    RPC_URLS.primary,
    { chainId: NETWORK_CONFIG.chainId, name: NETWORK_CONFIG.chainName },
    { staticNetwork: true }
  );
}

function toConnectedWallet(privateKey: string): HDNodeWallet | Wallet {
  return new Wallet(privateKey).connect(writeProvider());
}

function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

export function isValidSecretPhrase(phrase: string): boolean {
  const normalized = normalizePhrase(phrase);
  const words = normalized.split(' ');
  if (words.length !== 12 && words.length !== 24) return false;
  try {
    return Mnemonic.isValidMnemonic(normalized);
  } catch {
    return false;
  }
}

export async function loadAppWallet(): Promise<HDNodeWallet | Wallet | null> {
  const stored = await readStored();
  if (!stored) return null;
  return toConnectedWallet(stored.privateKey);
}

export async function createAppWallet(): Promise<HDNodeWallet> {
  const created = HDNodeWallet.createRandom();
  await writeStored({
    address: created.address.toLowerCase(),
    privateKey: created.privateKey,
    mnemonic: created.mnemonic?.phrase,
  });
  await SecureStore.deleteItemAsync(PHRASE_ACK_KEY).catch(() => {});
  return created.connect(writeProvider()) as HDNodeWallet;
}

export async function ensureAppWallet(): Promise<HDNodeWallet | Wallet> {
  const existing = await loadAppWallet();
  if (existing) {
    await bindAppWallet(existing.address);
    return existing;
  }
  return createAppWallet();
}

export async function wipeAppWallet(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(WALLET_KEY);
  } catch {
    // ignore
  }
  try {
    await SecureStore.deleteItemAsync(PHRASE_ACK_KEY);
  } catch {
    // ignore
  }
  await clearBoundWallet();
}

export async function recreateAppWallet(): Promise<HDNodeWallet> {
  await wipeAppWallet();
  return createAppWallet();
}

export function addressFromPhrase(phrase: string): string {
  const normalized = normalizePhrase(phrase);
  if (!isValidSecretPhrase(normalized)) {
    throw new Error('phrase');
  }
  return HDNodeWallet.fromPhrase(normalized).address.toLowerCase();
}

export async function importFromPhrase(phrase: string): Promise<HDNodeWallet> {
  const normalized = normalizePhrase(phrase);
  if (!isValidSecretPhrase(normalized)) {
    throw new Error('phrase');
  }
  const imported = HDNodeWallet.fromPhrase(normalized);
  const next = imported.address.toLowerCase();
  const bound = await getBoundWallet();
  if (bound && bound !== next) {
    await wipeAppWallet();
  }
  await writeStored({
    address: next,
    privateKey: imported.privateKey,
    mnemonic: imported.mnemonic?.phrase || normalized,
  });
  await markPhraseBackedUp();
  return imported.connect(writeProvider()) as HDNodeWallet;
}

export async function getSecretPhrase(): Promise<string | null> {
  const stored = await readStored();
  return stored?.mnemonic ? normalizePhrase(stored.mnemonic) : null;
}

export async function hasSecretPhrase(): Promise<boolean> {
  return Boolean(await getSecretPhrase());
}

export async function isPhraseBackedUp(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PHRASE_ACK_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markPhraseBackedUp(): Promise<void> {
  await SecureStore.setItemAsync(PHRASE_ACK_KEY, '1', OPTIONS);
}

async function cobrarGasPlataforma(
  signer: Signer,
  tokenTransfer: boolean,
  extraWei = 0n,
  followUp = false
): Promise<bigint> {
  const collector = await resolveFeeCollector(signer);
  const from = (await signer.getAddress()).toLowerCase();
  if (!collector || collector === from) return 0n;
  const feeWei =
    (await estimateNetworkGasWei(signer, tokenTransfer)) + (await estimateNetworkGasWei(signer, false));
  if (feeWei <= 0n) return 0n;
  const provider = signer.provider;
  if (!provider) throw new Error('provider');
  const balance = await provider.getBalance(from);
  const feeTxGas = await estimateNetworkGasWei(signer, false);
  const followGas = followUp ? await estimateNetworkGasWei(signer, tokenTransfer) : 0n;
  if (balance < feeWei + feeTxGas + followGas + extraWei) {
    throw new Error('platform-fee-bnb');
  }
  const tx = await signer.sendTransaction({ to: collector, value: feeWei });
  await tx.wait();
  return feeWei;
}

export async function cobrarComisionIntermediario(signer: Signer, tokenTransfer = true) {
  return cobrarGasPlataforma(signer, tokenTransfer, 0n, true);
}

export async function enviarToken(
  signer: Signer,
  tokenAddress: string,
  to: string,
  amountWei: string
) {
  if (!isHexAddress(to)) throw new Error('address');
  assertAmount(amountWei);
  await cobrarGasPlataforma(signer, true, 0n, true);
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  const tx = await token.transfer(to, amountWei);
  return tx.wait();
}

export async function enviarBnb(signer: Signer, to: string, amountWei: string) {
  if (!isHexAddress(to)) throw new Error('address');
  assertAmount(amountWei);
  await cobrarGasPlataforma(signer, false, BigInt(amountWei), true);
  const tx = await signer.sendTransaction({ to, value: amountWei });
  return tx.wait();
}

function assertAmount(amountWei: string) {
  if (!isAllowedWei(amountWei)) {
    throw new Error('invalid-amount');
  }
}
