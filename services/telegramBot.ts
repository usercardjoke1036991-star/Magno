import { TELEGRAM_BOT } from '../constants/appLinks';
import { notifyApiConfigured, notifyJsonBody } from './notifyClient';

function looksLikeTelegramToken(value: string): boolean {
  const raw = String(value || '').trim();
  if (/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(raw)) return true;
  const compact = raw.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
  return /^\d{6,}AA[A-Za-z0-9_]{8,}$/.test(compact);
}

function sanitizeBot(value: string): string {
  if (looksLikeTelegramToken(value)) return '';
  const username = String(value || '')
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 32);
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) return '';
  return username;
}

export function envTelegramBot(): string {
  return sanitizeBot(TELEGRAM_BOT);
}

/** Env local si existe; si no, username público del worker (sin token). */
export async function resolveTelegramBot(): Promise<string> {
  const fromEnv = envTelegramBot();
  if (fromEnv) return fromEnv;
  if (!notifyApiConfigured()) return '';
  try {
    const { response, body } = await notifyJsonBody<{ bot?: string }>('/telegram/bot', {
      timeoutMs: 8000,
    });
    if (!response.ok) return '';
    return sanitizeBot(String(body.bot || ''));
  } catch {
    return '';
  }
}
