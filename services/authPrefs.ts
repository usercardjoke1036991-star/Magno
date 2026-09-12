import * as SecureStore from 'expo-secure-store';
import { isAuthenticatorEnabled } from './authenticator';
import { isBiometricEnabled, isPinSet } from './appLock';
import { isEmailVerified } from './accountEmail';

const KEY = 'qc_auth_prefs_v2';
const LEGACY = 'qc_auth_prefs_v1';

export type AuthMethod = 'password' | 'email' | 'pin' | 'biometric' | 'authenticator';
export type AuthPurpose = 'unlock' | 'funds' | 'loanRequest' | 'loanPay';
export type AuthSlot = { on: boolean; method: AuthMethod };
export type AuthPrefs = Record<AuthPurpose, AuthSlot>;

export const AUTH_PURPOSES: AuthPurpose[] = ['unlock', 'funds', 'loanRequest', 'loanPay'];
export const AUTH_METHODS: AuthMethod[] = ['password', 'email', 'pin', 'biometric', 'authenticator'];

const DEFAULTS: AuthPrefs = {
  unlock: { on: false, method: 'password' },
  funds: { on: true, method: 'password' },
  loanRequest: { on: false, method: 'password' },
  loanPay: { on: false, method: 'password' },
};

function slot(on: boolean, method: AuthMethod | undefined): AuthSlot {
  const next =
    method === 'email' || method === 'pin' || method === 'biometric' || method === 'authenticator'
      ? method
      : 'password';
  return { on, method: next };
}

function normalize(raw: Partial<AuthPrefs> | Record<string, unknown>): AuthPrefs {
  const legacy = raw as Partial<Record<AuthPurpose | 'signin', AuthMethod | AuthSlot>>;
  return {
    unlock: asSlot(legacy.unlock, false),
    funds: asSlot(legacy.funds, true),
    loanRequest: asSlot(legacy.loanRequest, false),
    loanPay: asSlot(legacy.loanPay, false),
  };
}

function asSlot(value: AuthMethod | AuthSlot | undefined, fallbackOn: boolean): AuthSlot {
  if (value && typeof value === 'object' && 'method' in value) {
    return slot(Boolean(value.on), value.method);
  }
  if (typeof value === 'string') return slot(fallbackOn, value);
  return slot(fallbackOn, 'password');
}

async function readRaw(): Promise<AuthPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) return normalize(JSON.parse(raw) as Partial<AuthPrefs>);
    const legacy = await SecureStore.getItemAsync(LEGACY);
    if (legacy) return normalize(JSON.parse(legacy) as Record<string, unknown>);
    return { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function getAvailableMethods(): Promise<AuthMethod[]> {
  const methods: AuthMethod[] = ['password'];
  if (await isEmailVerified()) methods.push('email');
  if (await isPinSet()) methods.push('pin');
  if (await isBiometricEnabled()) methods.push('biometric');
  if (await isAuthenticatorEnabled()) methods.push('authenticator');
  return methods;
}

export async function isMethodReady(method: AuthMethod): Promise<boolean> {
  if (method === 'password') return true;
  if (method === 'email') return isEmailVerified();
  if (method === 'pin') return isPinSet();
  if (method === 'biometric') return isBiometricEnabled();
  return isAuthenticatorEnabled();
}

async function sanitize(prefs: AuthPrefs): Promise<AuthPrefs> {
  const next = { ...prefs };
  for (const purpose of AUTH_PURPOSES) {
    if (!(await isMethodReady(next[purpose].method))) {
      next[purpose] = { ...next[purpose], method: 'password' };
    }
  }
  return next;
}

async function persist(prefs: AuthPrefs): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(prefs));
}

export async function loadAuthPrefs(): Promise<AuthPrefs> {
  const raw = await readRaw();
  const next = await sanitize(raw);
  if (JSON.stringify(raw) !== JSON.stringify(next)) {
    await persist(next);
  }
  return next;
}

export async function saveAuthPrefs(prefs: AuthPrefs): Promise<AuthPrefs> {
  const next = await sanitize(prefs);
  for (const purpose of AUTH_PURPOSES) {
    if (next[purpose].on && !(await isMethodReady(next[purpose].method))) {
      throw new Error('method_not_ready');
    }
  }
  await persist(next);
  return next;
}

export async function getAuthMethod(purpose: AuthPurpose): Promise<AuthMethod> {
  const prefs = await loadAuthPrefs();
  return prefs[purpose].method;
}

export async function isAuthEnabled(purpose: AuthPurpose): Promise<boolean> {
  const prefs = await loadAuthPrefs();
  return prefs[purpose].on;
}

export async function setAuthMethod(purpose: AuthPurpose, method: AuthMethod): Promise<void> {
  if (!(await isMethodReady(method))) {
    throw new Error('method_not_ready');
  }
  const prefs = await readRaw();
  prefs[purpose] = { ...prefs[purpose], method };
  await persist(await sanitize(prefs));
}

export async function fallbackAuthIfNeeded(removed: AuthMethod): Promise<void> {
  const prefs = await readRaw();
  let changed = false;
  for (const purpose of AUTH_PURPOSES) {
    if (prefs[purpose].method === removed) {
      prefs[purpose] = { ...prefs[purpose], method: 'password' };
      changed = true;
    }
  }
  if (changed) await persist(prefs);
}
