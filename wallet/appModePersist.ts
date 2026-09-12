import type { AppMode } from '../constants/rpcConfig';

export const APP_MODE_STORAGE_KEY = 'quatrivium.appMode.v2';

/** Primera instalación: Real. Después: el último modo con el que se cerró la app. */
export function resolvePersistedMode(saved: string | null | undefined): AppMode {
  return saved === 'demo' ? 'demo' : 'live';
}
