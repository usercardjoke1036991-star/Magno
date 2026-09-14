import * as Linking from 'expo-linking';

export type AppDeepLink =
  | { kind: 'room'; room: 'wallet' | 'credit' | 'loans' | 'bonuses' | 'donate' | 'network' | 'people' | 'pool' | 'admin' | 'history' | 'ranks' }
  | { kind: 'settings'; panel: 'home' | 'security' };

const ROOMS = new Set(['wallet', 'credit', 'loans', 'bonuses', 'donate', 'network', 'people', 'pool', 'admin', 'history', 'ranks']);

function tokenFromUrl(url?: string | null): string {
  if (!url) return '';
  const parsed = Linking.parse(url);
  const parts = String(parsed.path || '')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter((part) => part && part !== '--');
  const fromQuery = String(parsed.queryParams?.room || parsed.queryParams?.panel || '').toLowerCase();
  const host = String(parsed.hostname || '').toLowerCase();
  const pathHead = parts[0] || '';
  const pathTail = parts[1] || '';
  const fromPath = pathHead === 'room' ? pathTail : pathHead;
  if (fromQuery) return fromQuery;
  if (host === 'room') return fromPath;
  if (host && host !== 'expo-development-client') return host;
  try {
    const nested = String(parsed.queryParams?.url || '');
    if (nested) {
      const inner = new URL(nested);
      const nestedRoom = (inner.searchParams.get('room') || inner.searchParams.get('panel') || '').toLowerCase();
      if (nestedRoom) return nestedRoom;
      const nestedParts = inner.pathname.replace(/^\/+|\/+$/g, '').split('/').filter((part) => part && part !== '--');
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
  if (token === 'settings') return { kind: 'settings', panel: 'home' };
  if (token === 'profile' || token === 'security') return { kind: 'settings', panel: 'home' };
  return null;
}
