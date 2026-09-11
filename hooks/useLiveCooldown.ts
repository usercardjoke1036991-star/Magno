import { useEffect, useState } from 'react';
import { cooldownRestanteDesdeTimestamp } from '../utils/creditCooldown';

/** Seconds left until the next loan can be requested. Ticks every second. */
export function useLiveCooldown(ultimoPrestamoTimestamp: number): number {
  const [left, setLeft] = useState(() => cooldownRestanteDesdeTimestamp(ultimoPrestamoTimestamp));

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const next = cooldownRestanteDesdeTimestamp(ultimoPrestamoTimestamp);
      setLeft(next);
      if (next <= 0 && id) {
        clearInterval(id);
        id = undefined;
      }
    };
    tick();
    if (cooldownRestanteDesdeTimestamp(ultimoPrestamoTimestamp) > 0) {
      id = setInterval(tick, 1000);
    }
    return () => {
      if (id) clearInterval(id);
    };
  }, [ultimoPrestamoTimestamp]);

  return left;
}
