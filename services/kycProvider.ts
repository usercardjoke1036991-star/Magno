import { Linking } from 'react-native';
import { isHttpsUrl } from '../utils/sanitize';
import { notifyJsonBody } from './notifyClient';
import { loadAppWallet } from './appWallet';
import { signedAuthBody } from './walletAuth';

export async function notifyKycProviderReady(): Promise<boolean> {
  try {
    const { response, body } = await notifyJsonBody<{ kycProvider?: boolean }>('/health', {
      method: 'GET',
    });
    return response.ok && body.kycProvider === true;
  } catch {
    return false;
  }
}

export async function openKycProvider(walletAddress: string): Promise<void> {
  const signer = await loadAppWallet();
  if (!signer || !walletAddress) throw new Error('wallet');
  const { response, body } = await notifyJsonBody<{ url?: string; error?: string }>('/kyc/provider-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedAuthBody(signer, walletAddress, 'identity')),
    timeoutMs: 20_000,
  });
  const url = String(body.url || '');
  if (!response.ok || !isHttpsUrl(url)) {
    throw new Error(body.error || 'provider');
  }
  const opened = await Linking.canOpenURL(url);
  if (!opened) throw new Error('provider');
  await Linking.openURL(url);
}
