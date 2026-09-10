import { NOTIFY_API } from '../constants/appLinks';
import { canonicalEmail, isValidEmail, normalizeEmail } from '../utils/emailPolicy';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';
import { getWalletWrapKey } from './walletSession';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { setPassword } from './appLock';
import { setWalletWrapKey } from './walletSession';

function wrapOk(value: string): boolean {
  return /^0x[0-9a-f]{64}$/.test(value);
}

export async function storePasswordRecovery(walletAddress: string): Promise<void> {
  const wrap = getWalletWrapKey();
  if (!NOTIFY_API || !walletAddress || !wrap || !wrapOk(wrap)) return;
  try {
    const signer = await loadAppWallet();
    if (!signer) return;
    await safeJsonFetch(`${NOTIFY_API}/password/recovery-store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(await signedAuthBody(signer, walletAddress, 'perfil')),
        wrap,
      }),
    });
  } catch {
    // La cuenta sigue; la recuperación quedará al volver a verificar el correo.
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
  const normalized = normalizeEmail(email);
  const trimmed = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(trimmed)) throw new Error('code');
  const response = await safeJsonFetch(`${NOTIFY_API}/password/recover-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalized, canonical: canonicalEmail(normalized), code: trimmed }),
  });
  let body: { wrap?: string; error?: string } = {};
  try {
    body = await readJsonLimited<{ wrap?: string; error?: string }>(response);
  } catch {
    body = {};
  }
  if (!response.ok || !body.wrap || !wrapOk(body.wrap)) {
    throw new Error(body.error || 'recover-verify');
  }
  setWalletWrapKey(body.wrap);
  await setPassword(nextPassword);
  try {
    const wallet = await loadAppWallet();
    if (wallet?.address) await storePasswordRecovery(wallet.address);
  } catch {
    // La nueva clave ya cifra la billetera en el teléfono.
  }
}
