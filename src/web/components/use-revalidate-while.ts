import { useEffect } from 'react';
import { useRevalidator } from 'react-router';

// How often a page reads its data again while a job runs: a session lasts for minutes
const POLL_INTERVAL_MS = 2000;

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
