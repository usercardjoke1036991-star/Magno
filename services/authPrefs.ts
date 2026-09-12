import * as SecureStore from 'expo-secure-store';
import { isAuthenticatorEnabled } from './authenticator';
import { isBiometricEnabled, isPinSet } from './appLock';

const KEY = 'qc_auth_prefs_v1';

export type AuthMethod = 'password' | 'pin' | 'biometric' | 'authenticator';
export type AuthPurpose = 'unlock' | 'funds' | 'signin';

export type AuthPrefs = Record<AuthPurpose, AuthMethod>;

const DEFAULTS: AuthPrefs = {
  unlock: 'password',
  funds: 'password',
  signin: 'password',
};

async function readRaw(): Promise<AuthPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AuthPrefs>;
    return {
      unlock: parsed.unlock ?? DEFAULTS.unlock,
      funds: parsed.funds ?? DEFAULTS.funds,
      signin: parsed.signin ?? DEFAULTS.signin,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function getAvailableMethods(): Promise<AuthMethod[]> {
  const methods: AuthMethod[] = ['password'];
  if (await isPinSet()) methods.push('pin');
  if (await isBiometricEnabled()) methods.push('biometric');
  if (await isAuthenticatorEnabled()) methods.push('authenticator');
  return methods;
}

export async function isMethodReady(method: AuthMethod): Promise<boolean> {
  if (method === 'password') return true;
  if (method === 'pin') return isPinSet();
  if (method === 'biometric') return isBiometricEnabled();
  return isAuthenticatorEnabled();
}

export async function loadAuthPrefs(): Promise<AuthPrefs> {
  const prefs = await readRaw();
  const next = { ...prefs };
  let changed = false;
  for (const purpose of Object.keys(next) as AuthPurpose[]) {
    if (!(await isMethodReady(next[purpose]))) {
      next[purpose] = 'password';
      changed = true;
    }
  }
  if (changed) {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  }
  return next;
}

export async function getAuthMethod(purpose: AuthPurpose): Promise<AuthMethod> {
  const prefs = await loadAuthPrefs();
  return prefs[purpose];
}

export async function setAuthMethod(purpose: AuthPurpose, method: AuthMethod): Promise<void> {
  if (!(await isMethodReady(method))) {
    throw new Error('method_not_ready');
  }
  const prefs = await readRaw();
  prefs[purpose] = method;
  await SecureStore.setItemAsync(KEY, JSON.stringify(prefs));
}

export async function fallbackAuthIfNeeded(removed: AuthMethod): Promise<void> {
  const prefs = await readRaw();
  let changed = false;
  for (const purpose of Object.keys(prefs) as AuthPurpose[]) {
    if (prefs[purpose] === removed) {
      prefs[purpose] = 'password';
      changed = true;
    }
  }
  if (changed) await SecureStore.setItemAsync(KEY, JSON.stringify(prefs));
}
