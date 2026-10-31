import { z } from 'zod/v4';

import type { ActionContext } from './context.ts';

const NOTES_INPUT_SCHEMA = z.object({ reference: z.string(), notes: z.string() });

export function createNotesActions({ workspace, findPosting }: ActionContext) {
  return {
    // Whatever its Status, Archived or not: the Notes replace the previous ones
    async saveNotes(rawInput: unknown): Promise<void> {
      const { reference, notes } = NOTES_INPUT_SCHEMA.parse(rawInput);
      await workspace.setNotes(await findPosting(reference), notes);
    },
  };
}
