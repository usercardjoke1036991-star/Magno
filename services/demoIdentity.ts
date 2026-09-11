import { NOTIFY_API } from '../constants/appLinks';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';
import type { PhoneAttestation } from './phoneOtp';

export async function requestDemoIdentity(walletAddress: string): Promise<PhoneAttestation> {
  if (!NOTIFY_API) throw new Error('notify');
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const response = await safeJsonFetch(`${NOTIFY_API}/demo-identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedAuthBody(signer, walletAddress, 'demo-identity')),
    timeoutMs: 20_000,
  });
  let body: PhoneAttestation & { error?: string } = {} as PhoneAttestation & { error?: string };
  try {
    body = await readJsonLimited<PhoneAttestation & { error?: string }>(response);
  } catch {
    body = {} as PhoneAttestation & { error?: string };
  }
  if (!response.ok) {
    throw new Error(body.error || 'demo-identity');
  }
  if (!body.phoneHash || !body.deviceHash || !body.r || !body.s) {
    throw new Error('demo-identity');
  }
  return body;
}
