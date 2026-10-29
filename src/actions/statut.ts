import { z } from 'zod/v4';

import { STATUT_SCHEMA } from '#/domain/index.ts';
import { assertStatutChange } from '#/statut/index.ts';

import type { ActionContext } from './context.ts';

const STATUT_INPUT_SCHEMA = z.object({ reference: z.string(), statut: STATUT_SCHEMA });

export function createStatutActions({ workspace, findOffre }: ActionContext) {
  return {
    async changeStatut(rawInput: unknown): Promise<void> {
      const { reference, statut } = STATUT_INPUT_SCHEMA.parse(rawInput);
      const offre = await findOffre(reference);
      assertStatutChange(offre, statut);
      await workspace.setStatut(offre, statut);
    },
  };
}
