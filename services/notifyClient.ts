import { notifyApiBases } from '../constants/appLinks';
import { readJsonLimited, safeJsonFetch } from '../utils/safeFetch';

const DEFAULT_TIMEOUT_MS = 15_000;

export function notifyApiConfigured(): boolean {
  return notifyApiBases().length > 0;
}

function isLocalNotify(url: string): boolean {
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(url);
}

function shouldTryNext(status: number): boolean {
  return status === 404 || status === 502 || status === 503 || status === 504;
}

async function localJsonFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...(rest.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** HTTPS público primero; en Metro también 127.0.0.1:8787 (adb reverse). */
export async function notifyJsonFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const bases = notifyApiBases();
  if (!bases.length) throw new Error('notify');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  let last: Error = new Error('notify');
  for (const base of bases) {
    const url = `${base}${suffix}`;
    try {
      const response = isLocalNotify(url)
        ? await localJsonFetch(url, init)
        : await safeJsonFetch(url, init);
      if (shouldTryNext(response.status)) {
        last = new Error('notify');
        continue;
      }
      return response;
    } catch (error) {
      last = error instanceof Error ? error : new Error('notify');
    }
  }
  throw last;
}

export async function notifyJsonBody<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ response: Response; body: T }> {
  const response = await notifyJsonFetch(path, init);
  let body = {} as T;
  try {
    body = await readJsonLimited<T>(response);
  } catch {
    body = {} as T;
  }
  return { response, body };
}
