// Where an Artifact, an extraction or a conversion stands, as the Posting page shows it: the one list
// the schema and the front's badges derive from. Without zod, so the front's bundle may import it.
export const STATE_LIST = ['absent', 'queued', 'in_progress', 'ready', 'failed'] as const;

export type State = (typeof STATE_LIST)[number];

// What the Posting page shows of the last job of an Artifact or of an extraction
export const STATE_BY_JOB_STATE = {
  queued: 'queued',
  running: 'in_progress',
  done: 'ready',
  failed: 'failed',
} as const;

// Its job is yet to finish, waiting in the queue or running: the page reads it again until it is
export function isPending(state: State): boolean {
  return state === 'queued' || state === 'in_progress';
}
