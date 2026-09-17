import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { notifyJsonBody } from './notifyClient';
import type { PhoneAttestation } from './phoneOtp';

export async function requestDemoIdentity(walletAddress: string): Promise<PhoneAttestation> {
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const { response, body } = await notifyJsonBody<PhoneAttestation & { error?: string }>('/demo-identity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedAuthBody(signer, walletAddress, 'demo-identity')),
    timeoutMs: 20_000,
  });
  if (!response.ok) {
    throw new Error(body.error || 'demo-identity');
  }
  if (!body.phoneHash || !body.deviceHash || !body.r || !body.s) {
    throw new Error('demo-identity');
  }
  return body;
}
