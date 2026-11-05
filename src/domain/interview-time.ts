import type { Interview } from './index.ts';

const MINUTE_MS = 60_000;

// When an Interview ends, its start plus its duration. Without zod, so the front's bundle may import it.
export function findInterviewEnd({ startAt, durationMinutes }: Pick<Interview, 'startAt' | 'durationMinutes'>): Date {
  return new Date(startAt.getTime() + durationMinutes * MINUTE_MS);
}

// Taken place once its start plus its duration has passed: an Interview in progress is still to come
export function hasTakenPlace(interview: Pick<Interview, 'startAt' | 'durationMinutes'>, now: Date): boolean {
  return findInterviewEnd(interview).getTime() <= now.getTime();
}
