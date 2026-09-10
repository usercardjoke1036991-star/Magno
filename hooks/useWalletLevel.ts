import { useEffect, useState } from 'react';
import { QuatriviumCreditService } from '../services/quatriviumCreditService';

const cache = new Map<string, { level: number; at: number }>();
const TTL_MS = 45_000;

export async function getWalletLevel(wallet?: string): Promise<number> {
  const key = String(wallet || '').toLowerCase();
  if (!key.startsWith('0x')) return 1;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.level;
  try {
    const progress = await QuatriviumCreditService.obtenerProgresoUsuario(key);
    const level = Math.min(10, Math.max(1, Number(progress.nivelActual) || 1));
    cache.set(key, { level, at: Date.now() });
    return level;
  } catch {
    return hit?.level || 1;
  }
}

export function rememberWalletLevel(wallet: string, level: number) {
  const key = wallet.toLowerCase();
  cache.set(key, { level: Math.min(10, Math.max(1, level || 1)), at: Date.now() });
}

export function useWalletLevel(wallet?: string, knownLevel?: number) {
  const [level, setLevel] = useState(() => {
    if (knownLevel && knownLevel > 0) return knownLevel;
    const key = String(wallet || '').toLowerCase();
    return cache.get(key)?.level || 1;
  });

  useEffect(() => {
    if (knownLevel && knownLevel > 0) {
      setLevel(knownLevel);
      if (wallet) rememberWalletLevel(wallet, knownLevel);
      return;
    }
    let cancelled = false;
    getWalletLevel(wallet).then((next) => {
      if (!cancelled) setLevel(next);
    });
    return () => {
      cancelled = true;
    };
  }, [wallet, knownLevel]);

  return level;
}
