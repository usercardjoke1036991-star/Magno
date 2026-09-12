import * as SecureStore from 'expo-secure-store';
import { isAuthenticatorEnabled } from './authenticator';
import { getBiometricStatus, isBiometricEnabled, isPinSet } from './appLock';
import { isEmailVerified } from './accountEmail';

const KEY = 'qc_auth_prefs_v2';
const LEGACY = 'qc_auth_prefs_v1';

export type AuthMethod = 'password' | 'email' | 'pin' | 'biometric' | 'authenticator';
export type AuthPurpose = 'signin' | 'unlock' | 'funds' | 'loanRequest' | 'loanPay';
export type AuthSlot = { on: boolean; methods: AuthMethod[]; method: AuthMethod };
export type AuthPrefs = Record<AuthPurpose, AuthSlot>;

export const AUTH_PURPOSES: AuthPurpose[] = ['signin', 'unlock', 'funds', 'loanRequest', 'loanPay'];
export const AUTH_METHODS: AuthMethod[] = ['password', 'email', 'pin', 'biometric', 'authenticator'];

const DEFAULTS: AuthPrefs = {
  signin: slot(false, ['password']),
  unlock: slot(false, ['password']),
  funds: slot(true, ['password']),
  loanRequest: slot(false, ['password']),
  loanPay: slot(false, ['password']),
};

function asMethod(value: unknown): AuthMethod {
  return AUTH_METHODS.includes(value as AuthMethod) ? (value as AuthMethod) : 'password';
}

function uniqueMethods(values: unknown): AuthMethod[] {
  const list = Array.isArray(values) ? values.map(asMethod) : [];
  return [...new Set(list)];
}

function slot(on: boolean, methods: AuthMethod[]): AuthSlot {
  const next = uniqueMethods(methods);
  const list: AuthMethod[] = next.length ? next : ['password'];
  return { on, methods: list, method: list[0] };
}

function asSlot(value: unknown, fallbackOn: boolean): AuthSlot {
  if (value && typeof value === 'object') {
    const raw = value as { on?: boolean; method?: AuthMethod; methods?: AuthMethod[] };
    const fromList = uniqueMethods(raw.methods);
    const fromOne = raw.method ? [asMethod(raw.method)] : [];
    return slot(Boolean(raw.on), fromList.length ? fromList : fromOne);
  }
  if (typeof value === 'string') return slot(fallbackOn, [asMethod(value)]);
  return slot(fallbackOn, ['password']);
}

function normalize(raw: Partial<AuthPrefs> | Record<string, unknown>): AuthPrefs {
  const legacy = raw as Partial<Record<AuthPurpose, AuthMethod | AuthSlot>>;
  return {
    signin: asSlot(legacy.signin, false),
    unlock: asSlot(legacy.unlock, false),
    funds: asSlot(legacy.funds, true),
    loanRequest: asSlot(legacy.loanRequest, false),
    loanPay: asSlot(legacy.loanPay, false),
  };
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
  if (await isMethodReady('biometric')) methods.push('biometric');
  if (await isAuthenticatorEnabled()) methods.push('authenticator');
  return methods;
}

export async function isMethodReady(method: AuthMethod): Promise<boolean> {
  if (method === 'password') return true;
  if (method === 'email') return isEmailVerified();
  if (method === 'pin') return isPinSet();
  if (method === 'biometric') {
    if (!(await isBiometricEnabled())) return false;
    return (await getBiometricStatus()).available;
  }
  return isAuthenticatorEnabled();
}

async function sanitize(prefs: AuthPrefs): Promise<AuthPrefs> {
  const next = { ...prefs };
  for (const purpose of AUTH_PURPOSES) {
    const ready: AuthMethod[] = [];
    for (const method of next[purpose].methods) {
      if (await isMethodReady(method)) ready.push(method);
    }
    next[purpose] = slot(next[purpose].on, ready);
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
    if (!next[purpose].on) continue;
    for (const method of next[purpose].methods) {
      if (!(await isMethodReady(method))) {
        throw new Error('method_not_ready');
      }
    }
  }
  await persist(next);
  if (next.unlock.on) {
    const { purgePersistedWrap } = await import('./savedSession');
    await purgePersistedWrap();
  }
  return next;
}

export async function getAuthMethods(purpose: AuthPurpose): Promise<AuthMethod[]> {
  const prefs = await loadAuthPrefs();
  return prefs[purpose].methods;
}

export async function getAuthMethod(purpose: AuthPurpose): Promise<AuthMethod> {
  const methods = await getAuthMethods(purpose);
  return methods[0] || 'password';
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
  prefs[purpose] = slot(prefs[purpose].on, [method]);
  await persist(await sanitize(prefs));
}

export async function setAuthMethods(purpose: AuthPurpose, methods: AuthMethod[]): Promise<void> {
  const prefs = await readRaw();
  prefs[purpose] = slot(true, methods);
  await persist(await sanitize(prefs));
}

export async function fallbackAuthIfNeeded(removed: AuthMethod): Promise<void> {
  const prefs = await readRaw();
  let changed = false;
  for (const purpose of AUTH_PURPOSES) {
    if (!prefs[purpose].methods.includes(removed)) continue;
    const next = prefs[purpose].methods.filter((item) => item !== removed);
    prefs[purpose] = slot(prefs[purpose].on, next);
    changed = true;
  }
  if (changed) await persist(prefs);
}
