import { useEffect } from 'react';
import { useRevalidator } from 'react-router';

// How often a page reads its data again while a job runs: a session lasts for minutes, the fake one of
// the e2e build (test/e2e-actions.server.ts) well under a second
const POLL_INTERVAL_MS = import.meta.env.MODE === 'e2e' ? 500 : 2000;

// The worker runs the jobs in its own process (ADR-0003): the page reads its data again until the
// job is done
export function useRevalidateWhile(isRunning: boolean): void {
  const { revalidate } = useRevalidator();
  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const interval = setInterval(() => void revalidate(), POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [isRunning, revalidate]);
}
