import { isHttpsUrl } from '../utils/sanitize';

export const PLAY_STORE_URL =
  process.env.EXPO_PUBLIC_PLAY_STORE_URL ||
  'https://play.google.com/store/apps/details?id=com.quatrivium.credit';

export const INVITE_WEB_BASE = (process.env.EXPO_PUBLIC_INVITE_WEB_BASE || '').replace(/\/$/, '');

/** Enlace de referido mientras no hay Play ni web pública. Abre la app si está instalada. */
export const INVITE_APP_SCHEME = 'quatrivium';

export const TELEGRAM_BOT = (process.env.EXPO_PUBLIC_TELEGRAM_BOT || '').replace(/^@/, '');

const rawNotify = (process.env.EXPO_PUBLIC_NOTIFY_API || '').replace(/\/$/, '');
export const NOTIFY_API = rawNotify && isHttpsUrl(rawNotify) ? rawNotify : '';

const LOCAL_NOTIFY = 'http://127.0.0.1:8787';

/** HTTPS público primero; en Metro también el worker local (adb reverse). */
export function notifyApiBases(): string[] {
  const bases: string[] = [];
  if (NOTIFY_API) bases.push(NOTIFY_API);
  if (typeof __DEV__ !== 'undefined' && __DEV__ && !bases.includes(LOCAL_NOTIFY)) {
    bases.push(LOCAL_NOTIFY);
  }
  return bases;
}
