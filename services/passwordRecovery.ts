import { NOTIFY_API } from '../constants/appLinks';
import { canonicalEmail, isValidEmail, normalizeEmail } from '../utils/emailPolicy';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';
import { getWalletWrapKey, setWalletWrapKey } from './walletSession';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { loadLocalRecoveryWrap, persistLocalRecoveryWrap, setPassword } from './appLock';

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
    throw new Error(message);
  }
}

export async function resetPasswordWithEmail(email: string, code: string, nextPassword: string): Promise<void> {
  if (!NOTIFY_API) throw new Error('notify');
  const localWrap = getWalletWrapKey() || (await loadLocalRecoveryWrap());
  if (!localWrap) throw new Error('device');
  setWalletWrapKey(localWrap);
  const normalized = normalizeEmail(email);
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
    throw new Error(body.error || 'recover-verify');
  }
  await setPassword(nextPassword);
}
