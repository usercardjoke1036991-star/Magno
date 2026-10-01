import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { keccak256, toUtf8Bytes } from 'ethers';
import { stripUnsafeText } from '../utils/sanitize';
import { storeSlot } from '../utils/storeSlot';

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
  /** true cuando el usuario eligió DNI/pasaporte en el formulario KYC (no en el alta de nombre). */
  docLocked: boolean;
  declaredAt: number;
}

export type KycIdentitySnapshot = Pick<KycDeclaration, 'legalName' | 'country' | 'city' | 'docType'>;

const PREFIX = `${storeSlot(['quatrivium', 'kyc'])}.`;
const PHOTO_KEY = `${storeSlot(['quatrivium', 'kyc', 'photo', 'v1'])}:`;
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
    storeSlot(['quatrivium', 'kyc', 'fp', 'v1']),
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
    docLocked: Boolean(parsed.docLocked),
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
  const incomingName = normalizeLegalName(draft.legalName);
  const boundLegalName = prev?.boundLegalName || incomingName;
  const legalName = boundLegalName;
  const incomingDoc = draft.docType !== undefined;
  const docLocked = Boolean(prev?.docLocked) || incomingDoc;
  const docType = prev?.docLocked
    ? prev.docType
    : incomingDoc
      ? safeDocType(draft.docType)
      : (prev?.docType || 'nationalId');
  const origin: KycIdentitySnapshot = {
    legalName: boundLegalName,
    country: prev?.country || normalizeCountry(draft.country ?? ''),
    city: prev?.city || normalizeCity(draft.city ?? ''),
    docType: prev?.docLocked ? prev.docType : docType,
  };
  const next: KycDeclaration = {
    legalName,
    boundLegalName,
    boundAt: prev?.boundAt || Date.now(),
    identityFingerprint: prev?.identityFingerprint || kycIdentityFingerprint(wallet, origin),
    country: normalizeCountry(draft.country ?? prev?.country ?? ''),
    city: normalizeCity(draft.city ?? prev?.city ?? ''),
    region: normalizeCity(draft.region ?? prev?.region ?? ''),
    docType,
    docLocked,
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
  try {
    await AsyncStorage.removeItem(PHOTO_KEY + walletKey(wallet));
  } catch {
    // ignore
  }
}

export async function loadKycDocPhoto(wallet: string): Promise<string> {
  if (!wallet) return '';
  try {
    return String((await AsyncStorage.getItem(PHOTO_KEY + walletKey(wallet))) || '').trim();
  } catch {
    return '';
  }
}

export async function persistKycDocPhoto(
  wallet: string,
  asset: { uri?: string; mimeType?: string | null; base64?: string | null }
): Promise<string> {
  if (!wallet) return '';
  const mime = asset.mimeType && /^image\/(jpeg|jpg|png|webp)$/i.test(asset.mimeType)
    ? asset.mimeType
    : 'image/jpeg';
  const ext = mime.includes('png') ? 'png' : 'jpg';
  const name = `quatrivium-kyc-${walletKey(wallet).slice(2, 10)}.${ext}`;
  let uri = '';
  try {
    if (Paths.document) {
      try {
        for (const item of Paths.document.list()) {
          if (item instanceof File && item.name.startsWith('quatrivium-kyc-')) {
            item.delete();
          }
        }
      } catch {
        // Se escribe igual la foto nueva.
      }
      const dest = new File(Paths.document, name);
      if (asset.base64) {
        dest.create();
        dest.write(asset.base64, { encoding: 'base64' });
        uri = dest.uri || '';
      } else if (asset.uri) {
        new File(asset.uri).copy(dest);
        uri = dest.uri || asset.uri;
      }
    }
  } catch {
    uri = String(asset.uri || '').trim();
  }
  if (!uri && asset.base64) {
    uri = `data:${mime};base64,${asset.base64}`;
  }
  if (uri && !uri.startsWith('data:')) {
    await AsyncStorage.setItem(PHOTO_KEY + walletKey(wallet), uri);
  }
  return uri;
}
