import { z } from 'zod/v4';

import { STATUS_SCHEMA } from '#/domain/index.ts';
import { assertStatusChange } from '#/status/index.ts';

import type { ActionContext } from './context.ts';

const STATUS_INPUT_SCHEMA = z.object({ reference: z.string(), status: STATUS_SCHEMA });

export function createStatusActions({ workspace, findPosting, findLocale }: ActionContext) {
  return {
    async changeStatus(rawInput: unknown): Promise<void> {
      const { reference, status } = STATUS_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      assertStatusChange(posting, status, await findLocale(posting.candidateId));
      await workspace.setStatus(posting, status);
    },
  };
}
