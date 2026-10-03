import { type Signer } from 'ethers';
import { notifyApiConfigured, notifyJsonBody } from './notifyClient';
import { signedAuthBody } from './walletAuth';

type TotpStatus = { enrolled?: boolean; pending?: boolean };
type TotpEnroll = { secret?: string; uri?: string; enrolled?: boolean };
type TotpOk = { ok?: boolean };

async function postAdminTotp<T>(
  path: string,
  signer: Signer,
  wallet: string,
  extra: Record<string, string> = {}
): Promise<{ status: number; body: T }> {
  const auth = await signedAuthBody(signer, wallet, 'admin-totp');
  const { response, body } = await notifyJsonBody<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...auth, ...extra }),
  });
  return { status: response.status, body };
}

export async function adminTotpStatus(signer: Signer, wallet: string): Promise<TotpStatus> {
  if (!notifyApiConfigured()) return {};
  const { status, body } = await postAdminTotp<TotpStatus>('/admin/totp/status', signer, wallet);
  if (status >= 400) throw new Error('admin-totp');
  return body;
}

export async function enrollAdminTotp(signer: Signer, wallet: string): Promise<TotpEnroll> {
  const { status, body } = await postAdminTotp<TotpEnroll>('/admin/totp/enroll', signer, wallet);
  if (status >= 400) throw new Error('admin-totp');
  return body;
}

export async function confirmAdminTotp(signer: Signer, wallet: string, code: string): Promise<boolean> {
  const { status, body } = await postAdminTotp<TotpOk>('/admin/totp/confirm', signer, wallet, { code });
  if (status >= 400) return false;
  return Boolean(body.ok);
}

export async function verifyAdminTotp(signer: Signer, wallet: string, code: string): Promise<boolean> {
  const { status, body } = await postAdminTotp<TotpOk>('/admin/totp/verify', signer, wallet, { code });
  if (status >= 400) return false;
  return Boolean(body.ok);
}
