import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { notifyApiConfigured, notifyJsonBody } from './notifyClient';
import { isValidPhone, normalizePhone } from './notificationProfile';

export { notifyApiConfigured };

export async function requestPhoneOtp(walletAddress: string, phone: string): Promise<void> {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized) || !normalized) throw new Error('phone');
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const { response, body } = await notifyJsonBody<{ error?: string }>('/otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedAuthBody(signer, walletAddress, 'otp', { phone: normalized })),
  });
  if (!response.ok) {
    throw new Error(body.error || 'otp-request');
  }
}

export interface PhoneAttestation {
  phoneHash: string;
  deviceHash: string;
  deadline: number;
  v: number;
  r: string;
  s: string;
}

export async function verifyPhoneOtp(
  walletAddress: string,
  phone: string,
  code: string
): Promise<PhoneAttestation> {
  const normalized = normalizePhone(phone);
  const trimmed = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(trimmed)) throw new Error('code');
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const { response, body } = await notifyJsonBody<PhoneAttestation & { error?: string }>('/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(await signedAuthBody(signer, walletAddress, 'otp', { phone: normalized })),
      code: trimmed,
    }),
  });
  if (!response.ok) {
    throw new Error(body.error || 'otp-verify');
  }
  if (!body.phoneHash || !body.deviceHash || !body.r || !body.s) {
    throw new Error('otp-verify');
  }
  return body;
}
