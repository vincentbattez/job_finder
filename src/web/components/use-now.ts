import { useEffect, useState } from 'react';

// The time now, read again at each interval. A page the server renders starts from the loader's time, so
// that the server's render and the browser's agree.
export function useNow(intervalMs: number, initial = Date.now()): number {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(interval);
    };
  }, [intervalMs]);
  return now;
}
