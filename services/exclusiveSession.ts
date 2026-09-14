import { notifyApiBases } from '../constants/appLinks';
import { isHttpsUrl } from '../utils/sanitize';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';

function isLocalNotify(base: string): boolean {
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(base.replace(/\/$/, ''));
}

async function postSession(path: string, body: Record<string, unknown>): Promise<Response | null> {
  const payload = JSON.stringify(body);
  for (const base of notifyApiBases()) {
    const root = base.replace(/\/$/, '');
    const url = `${root}${path}`;
    try {
      if (isLocalNotify(root)) {
        return await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: payload,
        });
      }
      if (!isHttpsUrl(url)) continue;
      return await safeJsonFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        timeoutMs: 8000,
      });
    } catch {
      // Probar el siguiente origen.
    }
  }
  return null;
}

/** true = este aparato. false = otro aparato. null = no se pudo comprobar. */
export async function thisDeviceOwnsSession(): Promise<boolean | null> {
  try {
    const signer = await loadAppWallet();
    if (!signer) return null;
    const wallet = (await signer.getAddress()).toLowerCase();
    const response = await postSession(
      '/session/check',
      await signedAuthBody(signer, wallet, 'session')
    );
    if (!response) return null;
    const data = await readJsonLimited<{ owner?: boolean }>(response);
    if (typeof data.owner !== 'boolean') return null;
    return data.owner;
  } catch {
    return null;
  }
}

export async function claimExclusiveSession(): Promise<void> {
  try {
    const signer = await loadAppWallet();
    if (!signer) return;
    const wallet = (await signer.getAddress()).toLowerCase();
    const response = await postSession(
      '/session/claim',
      await signedAuthBody(signer, wallet, 'session')
    );
    if (response && !response.ok) {
      return;
    }
  } catch {
    // Sin worker la exclusividad no corre; el resto de la app sí.
  }
}
