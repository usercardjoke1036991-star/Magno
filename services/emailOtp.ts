import { NOTIFY_API } from '../constants/appLinks';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { isValidEmail, normalizeEmail } from '../utils/emailPolicy';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';
import { saveVerifiedEmail } from './accountEmail';

export async function requestEmailOtp(walletAddress: string, email: string): Promise<void> {
  if (!NOTIFY_API) throw new Error('notify');
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) throw new Error('email');
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const response = await safeJsonFetch(`${NOTIFY_API}/email/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedAuthBody(signer, walletAddress, 'email', { phone: normalized })),
  });
  if (!response.ok) {
    let message = 'email-request';
    try {
      const body = await readJsonLimited<{ error?: string }>(response);
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}

export async function verifyEmailOtp(walletAddress: string, email: string, code: string): Promise<string> {
  if (!NOTIFY_API) throw new Error('notify');
  const normalized = normalizeEmail(email);
  const trimmed = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(trimmed)) throw new Error('code');
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const response = await safeJsonFetch(`${NOTIFY_API}/email/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(await signedAuthBody(signer, walletAddress, 'email', { phone: normalized })),
      code: trimmed,
    }),
  });
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = await readJsonLimited<{ ok?: boolean; error?: string }>(response);
  } catch {
    body = {};
  }
  if (!response.ok || !body.ok) {
    throw new Error(body.error || 'email-verify');
  }
  return saveVerifiedEmail(normalized);
}
