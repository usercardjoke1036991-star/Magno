import * as SecureStore from 'expo-secure-store';
import { keccak256, toUtf8Bytes } from 'ethers';
import { stripUnsafeText } from '../utils/sanitize';

export type KycDocType = 'nationalId' | 'passport' | 'other';

export interface KycDeclaration {
  legalName: string;
  boundLegalName: string;
  boundAt: number;
  identityFingerprint: string;
  country: string;
  city: string;
  region: string;
  docType: KycDocType;
  declaredAt: number;
}

export type KycIdentitySnapshot = Pick<KycDeclaration, 'legalName' | 'country' | 'city' | 'docType'>;

const PREFIX = 'quatrivium.kyc.';
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

function walletKey(wallet: string): string {
  return wallet.trim().toLowerCase();
}

export function normalizeLegalName(value: string): string {
  return stripUnsafeText(value, 80);
}

export function normalizeCountry(value: string): string {
  return stripUnsafeText(value, 56);
}

export function normalizeCity(value: string): string {
  return stripUnsafeText(value, 56);
}

export function isValidLegalName(value: string): boolean {
  return normalizeLegalName(value).length >= 4;
}

export function isValidKyc(draft: Pick<KycDeclaration, 'legalName' | 'country' | 'city' | 'docType'>): boolean {
  return isValidLegalName(draft.legalName)
    && normalizeCountry(draft.country).length >= 2
    && normalizeCity(draft.city).length >= 2
    && Boolean(draft.docType);
}

function safeDocType(value: unknown): KycDocType {
  return value === 'passport' || value === 'other' || value === 'nationalId' ? value : 'nationalId';
}

export function kycIdentitySource(wallet: string, snapshot: KycIdentitySnapshot): string {
  return [
    'quatrivium.kyc.fp.v1',
    walletKey(wallet),
    normalizeLegalName(snapshot.legalName),
    normalizeCountry(snapshot.country),
    normalizeCity(snapshot.city),
    safeDocType(snapshot.docType),
  ].join('\n');
}

export function kycIdentityFingerprint(wallet: string, snapshot: KycIdentitySnapshot): string {
  return keccak256(toUtf8Bytes(kycIdentitySource(wallet, snapshot)));
}

export function formatKycFingerprint(value: string): string {
  const hex = String(value || '').replace(/^0x/i, '').toLowerCase();
  if (hex.length < 12) return '';
  return `0x${hex.slice(0, 10)}…`;
}

function parseDeclaration(parsed: Partial<KycDeclaration>): KycDeclaration | null {
  const legalName = normalizeLegalName(String(parsed.legalName || parsed.boundLegalName || ''));
  if (!legalName) return null;
  const boundLegalName = normalizeLegalName(String(parsed.boundLegalName || legalName));
  return {
    legalName,
    boundLegalName,
    boundAt: Number(parsed.boundAt) || Number(parsed.declaredAt) || 0,
    identityFingerprint: /^0x[0-9a-f]{64}$/i.test(String(parsed.identityFingerprint || ''))
      ? String(parsed.identityFingerprint).toLowerCase()
      : '',
    country: normalizeCountry(String(parsed.country || '')),
    city: normalizeCity(String(parsed.city || '')),
    region: normalizeCity(String(parsed.region || '')),
    docType: safeDocType(parsed.docType),
    declaredAt: Number(parsed.declaredAt) || 0,
  };
}

export async function loadKycDeclaration(wallet: string): Promise<KycDeclaration | null> {
  if (!wallet) return null;
  try {
    const raw = await SecureStore.getItemAsync(PREFIX + walletKey(wallet));
    if (!raw) return null;
    return parseDeclaration(JSON.parse(raw) as Partial<KycDeclaration>);
  } catch {
    return null;
  }
}

export async function loadBoundLegalName(wallet: string): Promise<string> {
  const saved = await loadKycDeclaration(wallet);
  return saved?.boundLegalName || saved?.legalName || '';
}

export async function saveKycDeclaration(
  wallet: string,
  draft: Partial<KycDeclaration> & Pick<KycDeclaration, 'legalName'>
): Promise<KycDeclaration> {
  const prev = await loadKycDeclaration(wallet);
  const legalName = normalizeLegalName(draft.legalName);
  const boundLegalName = prev?.boundLegalName || legalName;
  const origin: KycIdentitySnapshot = {
    legalName: prev?.boundLegalName || legalName,
    country: prev?.country || normalizeCountry(draft.country ?? ''),
    city: prev?.city || normalizeCity(draft.city ?? ''),
    docType: prev?.docType || safeDocType(draft.docType),
  };
  const next: KycDeclaration = {
    legalName,
    boundLegalName,
    boundAt: prev?.boundAt || Date.now(),
    identityFingerprint: prev?.identityFingerprint || kycIdentityFingerprint(wallet, origin),
    country: normalizeCountry(draft.country ?? prev?.country ?? ''),
    city: normalizeCity(draft.city ?? prev?.city ?? ''),
    region: normalizeCity(draft.region ?? prev?.region ?? ''),
    docType: prev?.docType || safeDocType(draft.docType),
    declaredAt: prev?.declaredAt || Date.now(),
  };
  await SecureStore.setItemAsync(PREFIX + walletKey(wallet), JSON.stringify(next), OPTIONS);
  return next;
}

export async function bindLegalIdentity(wallet: string, legalName: string): Promise<KycDeclaration> {
  return saveKycDeclaration(wallet, { legalName });
}

export async function clearKycDeclaration(wallet: string): Promise<void> {
  if (!wallet) return;
  try {
    await SecureStore.deleteItemAsync(PREFIX + walletKey(wallet));
  } catch {
    // ignore
  }
}
