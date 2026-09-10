import { isHttpsUrl } from '../utils/sanitize';

export const PLAY_STORE_URL =
  process.env.EXPO_PUBLIC_PLAY_STORE_URL ||
  'https://play.google.com/store/apps/details?id=com.quatrivium.credit';

export const INVITE_WEB_BASE = (process.env.EXPO_PUBLIC_INVITE_WEB_BASE || '').replace(/\/$/, '');

export const TELEGRAM_BOT = (process.env.EXPO_PUBLIC_TELEGRAM_BOT || '').replace(/^@/, '');

const rawNotify = (process.env.EXPO_PUBLIC_NOTIFY_API || '').replace(/\/$/, '');
export const NOTIFY_API = rawNotify && isHttpsUrl(rawNotify) ? rawNotify : '';
