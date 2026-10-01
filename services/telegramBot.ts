import { TELEGRAM_BOT } from '../constants/appLinks';
import { notifyApiConfigured, notifyJsonBody } from './notifyClient';

function sanitizeBot(value: string): string {
  return String(value || '')
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 32);
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
