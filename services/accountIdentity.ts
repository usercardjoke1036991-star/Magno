import { isDemoAccount } from '../constants/rpcConfig';
import { identityHashBound } from '../utils/creditGates';
import { clearVerifiedEmail, saveVerifiedEmail } from './accountEmail';
import { isPhoneActive, saveVerifiedPhone, setPhoneActive } from './accountPhone';
import { loadAppWallet } from './appWallet';
import { notifyJsonBody } from './notifyClient';
import type { PhoneAttestation } from './phoneOtp';
import { QuatriviumCreditService } from './quatriviumCreditService';
import { signedAuthBody } from './walletAuth';

export type IdentityStatus = {
  email: string;
  phone: string;
  emailActive: boolean;
  phoneActive: boolean;
};

const emptyStatus = (): IdentityStatus => ({
  email: '',
  phone: '',
  emailActive: false,
  phoneActive: false,
});

export async function fetchIdentityStatus(walletAddress: string): Promise<IdentityStatus> {
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const { response, body } = await notifyJsonBody<IdentityStatus & { error?: string }>('/identity/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signedAuthBody(signer, walletAddress, 'identity')),
  });
  if (!response.ok) {
    throw new Error(body.error || 'identity-status');
  }
  return {
    email: String(body.email || ''),
    phone: String(body.phone || ''),
    emailActive: Boolean(body.emailActive),
    phoneActive: Boolean(body.phoneActive),
  };
}

export async function releaseAccountContact(
  walletAddress: string,
  target: 'email' | 'phone'
): Promise<void> {
  const signer = await loadAppWallet();
  if (!signer) throw new Error('appWalletNotReady');
  const { response, body } = await notifyJsonBody<{ ok?: boolean; error?: string }>('/identity/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(await signedAuthBody(signer, walletAddress, 'identity')),
      target,
    }),
  });
  if (!response.ok || !body.ok) {
    throw new Error(body.error || 'identity-release');
  }
}

export async function restoreIdentityLocal(walletAddress: string): Promise<IdentityStatus | null> {
  if (!walletAddress) return null;
  try {
    const status = await fetchIdentityStatus(walletAddress);
    if (status.emailActive && status.email) await saveVerifiedEmail(status.email);
    else if (!status.emailActive) await clearVerifiedEmail();
    if (!status.phoneActive) await setPhoneActive(false);
    else if (status.phone) await saveVerifiedPhone(status.phone);
    else await setPhoneActive(true);
    return status;
  } catch {
    return null;
  }
}

export async function resumeDeviceIfNeeded(walletAddress: string): Promise<boolean> {
  if (isDemoAccount()) return true;
  if (!(await isPhoneActive())) return false;
  try {
    const signer = await loadAppWallet();
    if (!signer) return false;
    const { response, body } = await notifyJsonBody<
      PhoneAttestation & { already?: boolean; error?: string }
    >('/identity/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await signedAuthBody(signer, walletAddress, 'identity')),
    });
    if (!response.ok) return false;
    if (body.already) return true;
    if (!identityHashBound(body.phoneHash) || !body.r || !body.s) return false;
    await QuatriviumCreditService.vincularIdentidad(
      body.phoneHash,
      body.deviceHash,
      body.deadline,
      body.v,
      body.r,
      body.s
    );
    return true;
  } catch {
    return false;
  }
}

export async function hydrateAccountIdentity(walletAddress: string): Promise<IdentityStatus> {
  const restored = await restoreIdentityLocal(walletAddress);
  if (restored?.phoneActive) {
    void resumeDeviceIfNeeded(walletAddress);
  }
  return restored || emptyStatus();
}
