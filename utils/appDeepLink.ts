import * as Linking from 'expo-linking';

export type AppDeepLink =
  | { kind: 'room'; room: 'wallet' | 'credit' | 'loans' | 'bonuses' | 'donate' | 'network' | 'people' | 'pool' | 'reserva' | 'admin' | 'history' | 'ranks' | 'fame' }
  | { kind: 'settings'; panel: 'home' | 'security' | 'privacy' | 'terms' }
  | { kind: 'mode'; mode: 'demo' | 'live' };

const ROOMS = new Set(['wallet', 'credit', 'loans', 'bonuses', 'donate', 'network', 'people', 'pool', 'reserva', 'admin', 'history', 'ranks', 'fame']);

function trimPathSlashes(path: string): string {
  let s = path;
  while (s.startsWith('/')) s = s.slice(1);
  while (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

function tokenFromUrl(url?: string | null): string {
  if (!url) return '';
  const parsed = Linking.parse(url);
  const parts = trimPathSlashes(String(parsed.path || ''))
    .split('/')
    .filter((part) => part && part !== '--');
  const fromQuery = String(parsed.queryParams?.room || parsed.queryParams?.panel || '').toLowerCase();
  const host = String(parsed.hostname || '').toLowerCase();
  const pathHead = parts[0] || '';
  const pathTail = parts[1] || '';
  const fromPath = pathHead === 'room' ? pathTail : pathHead;
  if (fromQuery) return fromQuery;
  if (host === 'room') return fromPath;
  if (host === 'settings') return (pathHead || 'settings').toLowerCase();
  if (host === 'mode') return (pathHead || '').toLowerCase();
  if (host && host !== 'expo-development-client') return host;
  try {
    const nested = String(parsed.queryParams?.url || '');
    if (nested) {
      const inner = new URL(nested);
      const nestedRoom = (inner.searchParams.get('room') || inner.searchParams.get('panel') || '').toLowerCase();
      if (nestedRoom) return nestedRoom;
      const nestedParts = trimPathSlashes(inner.pathname).split('/').filter((part) => part && part !== '--');
      const nestedPath = nestedParts[0] === 'room' ? nestedParts[1] || '' : nestedParts[0] || '';
      if (nestedPath) return nestedPath.toLowerCase();
    }
  } catch {
    // ignore
  }
  return fromPath.toLowerCase();
}

export function parseAppDeepLink(url?: string | null): AppDeepLink | null {
  const token = tokenFromUrl(url);
  if (ROOMS.has(token)) {
    return { kind: 'room', room: token as Extract<AppDeepLink, { kind: 'room' }>['room'] };
  }
  if (token === 'privacy' || token === 'terms') return { kind: 'settings', panel: token };
  if (token === 'settings') return { kind: 'settings', panel: 'home' };
  if (token === 'security') return { kind: 'settings', panel: 'security' };
  if (token === 'profile') return { kind: 'settings', panel: 'home' };
  if (token === 'demo') return { kind: 'mode', mode: 'demo' };
  if (token === 'live' || token === 'real') return { kind: 'mode', mode: 'live' };
  return null;
}
