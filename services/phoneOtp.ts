import { NOTIFY_API } from '../constants/appLinks';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { isValidPhone, normalizePhone } from './notificationProfile';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';

export function notifyApiConfigured(): boolean {
  return Boolean(NOTIFY_API);
}

export async function requestPhoneOtp(walletAddress: string, phone: string): Promise<void> {
  if (!NOTIFY_API) throw new Error('notify');
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized) || !normalized) throw new Error('phone');
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const response = await safeJsonFetch(`${NOTIFY_API}/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedAuthBody(signer, walletAddress, 'otp', { phone: normalized })),
  });
  if (!response.ok) {
    let message = 'otp-request';
    try {
      const body = await readJsonLimited<{ error?: string }>(response);
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
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
  if (!NOTIFY_API) throw new Error('notify');
  const normalized = normalizePhone(phone);
  const trimmed = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(trimmed)) throw new Error('code');
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const response = await safeJsonFetch(`${NOTIFY_API}/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(await signedAuthBody(signer, walletAddress, 'otp', { phone: normalized })),
      code: trimmed,
    }),
  });
  let body: PhoneAttestation & { error?: string } = {} as PhoneAttestation & { error?: string };
  try {
    body = await readJsonLimited<PhoneAttestation & { error?: string }>(response);
  } catch {
    body = {} as PhoneAttestation & { error?: string };
  }
  if (!response.ok) {
    throw new Error(body.error || 'otp-verify');
  }
  if (!body.phoneHash || !body.deviceHash || !body.r || !body.s) {
    throw new Error('otp-verify');
  }
  return body;
}
