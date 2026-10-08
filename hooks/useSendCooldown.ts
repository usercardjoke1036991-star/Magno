import { useEffect, useRef, useState } from 'react';

export function useSendCooldown(seconds = 60) {
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const tick = (n: number) => {
    setLeft(n);
    if (n <= 0) return;
    timer.current = setTimeout(() => tick(n - 1), 1000);
  };

  const start = () => {
    if (timer.current) clearTimeout(timer.current);
    tick(seconds);
  };

  return { left, start };
}
