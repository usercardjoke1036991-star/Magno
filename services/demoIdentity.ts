import { notifyApiBases } from '../constants/appLinks';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';
import type { PhoneAttestation } from './phoneOtp';

export async function requestDemoIdentity(walletAddress: string): Promise<PhoneAttestation> {
  const bases = notifyApiBases();
  if (!bases.length) throw new Error('notify');
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const payload = JSON.stringify(await signedAuthBody(signer, walletAddress, 'demo-identity'));
  let lastError: Error = new Error('notify');
  for (const base of bases) {
    try {
      const response = await safeJsonFetch(`${base}/demo-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        timeoutMs: 20_000,
      });
      let body: PhoneAttestation & { error?: string } = {} as PhoneAttestation & { error?: string };
      try {
        body = await readJsonLimited<PhoneAttestation & { error?: string }>(response);
      } catch {
        body = {} as PhoneAttestation & { error?: string };
      }
      if (!response.ok) {
        lastError = new Error(body.error || 'demo-identity');
        continue;
      }
      if (!body.phoneHash || !body.deviceHash || !body.r || !body.s) {
        lastError = new Error('demo-identity');
        continue;
      }
      return body;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('demo-identity');
    }
  }
  throw lastError;
}
