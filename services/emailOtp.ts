import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { notifyJsonBody } from './notifyClient';
import { isValidEmail, normalizeEmail } from '../utils/emailPolicy';
import { saveVerifiedEmail } from './accountEmail';

export async function requestEmailOtp(walletAddress: string, email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) throw new Error('email');
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const { response, body } = await notifyJsonBody<{ error?: string }>('/email/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedAuthBody(signer, walletAddress, 'email', { phone: normalized })),
  });
  if (!response.ok) {
    throw new Error(body.error || 'email-request');
  }
}

export async function verifyEmailOtp(walletAddress: string, email: string, code: string): Promise<string> {
  const normalized = normalizeEmail(email);
  const trimmed = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(trimmed)) throw new Error('code');
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const { response, body } = await notifyJsonBody<{ ok?: boolean; error?: string }>('/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(await signedAuthBody(signer, walletAddress, 'email', { phone: normalized })),
      code: trimmed,
    }),
  });
  if (!response.ok || !body.ok) {
    throw new Error(body.error || 'email-verify');
  }
  return saveVerifiedEmail(normalized);
}
