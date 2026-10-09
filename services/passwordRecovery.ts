import AsyncStorage from '@react-native-async-storage/async-storage';
import { NOTIFY_API } from '../constants/appLinks';
import { canonicalEmail, isValidEmail, normalizeEmail } from '../utils/emailPolicy';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';
import { getWalletWrapKey, setWalletWrapKey } from './walletSession';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { loadLocalRecoveryWrap, persistLocalRecoveryWrap, setPassword } from './appLock';

const RECOVER_ATTEMPTS = 3;
const RECOVER_WAIT_MS = 60_000;

type RecoverQuota = { day: string; attempts: number; sends: number; lastSent: number };

function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function quotaKey(email: string): string {
  return `quatrivium.recoverQuota.v1.${canonicalEmail(normalizeEmail(email))}`;
}

export async function readRecoverQuota(email: string): Promise<RecoverQuota> {
  const day = utcDay();
  const empty = { day, attempts: 0, sends: 0, lastSent: 0 };
  try {
    const raw = await AsyncStorage.getItem(quotaKey(email));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<RecoverQuota>;
    if (parsed.day !== day) return empty;
    return {
      day,
      attempts: Math.max(0, Number(parsed.attempts) || 0),
      sends: Math.max(0, Number(parsed.sends) || 0),
      lastSent: Math.max(0, Number(parsed.lastSent) || 0),
    };
  } catch {
    return empty;
  }
}

async function writeRecoverQuota(email: string, quota: RecoverQuota): Promise<void> {
  await AsyncStorage.setItem(quotaKey(email), JSON.stringify(quota)).catch(() => {});
}

export function recoverSendWaitSeconds(quota: RecoverQuota, now = Date.now()): number {
  if (quota.lastSent <= 0) return 0;
  const wait = RECOVER_WAIT_MS - (now - quota.lastSent);
  if (wait <= 0) return 0;
  return Math.ceil(wait / 1000);
}

async function rememberRecoverLimit(email: string, error: string): Promise<void> {
  const quota = await readRecoverQuota(email);
  if (error === 'day') {
    quota.attempts = RECOVER_ATTEMPTS;
  }
  if (error === 'cooldown') {
    quota.lastSent = Date.now();
  }
  await writeRecoverQuota(email, quota);
}

export async function storePasswordRecovery(walletAddress: string): Promise<void> {
  await persistLocalRecoveryWrap();
  if (!NOTIFY_API || !walletAddress) return;
  try {
    const signer = await loadAppWallet();
    if (!signer) return;
    await safeJsonFetch(`${NOTIFY_API}/password/recovery-store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await signedAuthBody(signer, walletAddress, 'perfil')),
    });
  } catch {
    console.warn('No se pudo confirmar el correo de recuperación. Verifique el correo de nuevo más tarde.');
  }
}

export async function requestPasswordRecovery(email: string): Promise<void> {
  if (!NOTIFY_API) throw new Error('notify');
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) throw new Error('email');
  const quota = await readRecoverQuota(normalized);
  if (quota.attempts >= RECOVER_ATTEMPTS || quota.sends >= RECOVER_ATTEMPTS) throw new Error('day');
  if (recoverSendWaitSeconds(quota) > 0) throw new Error('cooldown');
  const response = await safeJsonFetch(`${NOTIFY_API}/password/recover-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalized, canonical: canonicalEmail(normalized) }),
  });
  if (!response.ok) {
    let message = 'recover-request';
    try {
      const body = await readJsonLimited<{ error?: string }>(response);
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    await rememberRecoverLimit(normalized, message);
    throw new Error(message);
  }
  quota.sends += 1;
  quota.lastSent = Date.now();
  await writeRecoverQuota(normalized, quota);
}

export async function resetPasswordWithEmail(email: string, code: string, nextPassword: string): Promise<void> {
  if (!NOTIFY_API) throw new Error('notify');
  const localWrap = getWalletWrapKey() || (await loadLocalRecoveryWrap());
  if (!localWrap) throw new Error('device');
  setWalletWrapKey(localWrap);
  const normalized = normalizeEmail(email);
  const quota = await readRecoverQuota(normalized);
  if (quota.attempts >= RECOVER_ATTEMPTS) throw new Error('day');
  const trimmed = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(trimmed)) throw new Error('code');
  const response = await safeJsonFetch(`${NOTIFY_API}/password/recover-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalized, canonical: canonicalEmail(normalized), code: trimmed }),
  });
  let body: { ok?: boolean; error?: string; wrap?: string } = {};
  try {
    body = await readJsonLimited<{ ok?: boolean; error?: string; wrap?: string }>(response);
  } catch {
    body = {};
  }
  if (body.wrap) {
    throw new Error('wrap');
  }
  if (!response.ok || body.ok !== true) {
    const reason = body.error || 'recover-verify';
    if (reason === 'day') {
      await rememberRecoverLimit(normalized, 'day');
    } else if (reason === 'code' || reason === 'recover-verify') {
      quota.attempts += 1;
      await writeRecoverQuota(normalized, quota);
    }
    throw new Error(reason);
  }
  quota.attempts += 1;
  await writeRecoverQuota(normalized, quota);
  await setPassword(nextPassword);
}
