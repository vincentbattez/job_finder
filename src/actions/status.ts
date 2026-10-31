import { z } from 'zod/v4';

import { STATUS_SCHEMA } from '#/domain/index.ts';
import { assertStatusChange } from '#/status/index.ts';

import type { ActionContext } from './context.ts';

const STATUS_INPUT_SCHEMA = z.object({ reference: z.string(), status: STATUS_SCHEMA });

const REFERENCE_INPUT_SCHEMA = z.object({ reference: z.string() });

export function createStatusActions({ workspace, findPosting, findLocale }: ActionContext) {
  return {
    async changeStatus(rawInput: unknown): Promise<void> {
      const { reference, status } = STATUS_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      assertStatusChange(posting, status, await findLocale(posting.candidateId));
      await workspace.setStatus(posting, status);
    },

    // Whatever its Status, which stays as it is (ADR-0007); archiving again keeps the first date,
    // which sorts the Archived
    async archive(rawInput: unknown): Promise<void> {
      const posting = await findPosting(REFERENCE_INPUT_SCHEMA.parse(rawInput).reference);
      await workspace.setArchivedAt(posting, posting.archivedAt ?? new Date());
    },

    // Only removes the mark: the Posting is found exactly where it was
    async unarchive(rawInput: unknown): Promise<void> {
      const posting = await findPosting(REFERENCE_INPUT_SCHEMA.parse(rawInput).reference);
      await workspace.setArchivedAt(posting, null);
    },
  };
}
