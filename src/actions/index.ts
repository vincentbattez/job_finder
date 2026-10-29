import { z } from 'zod/v4';

import { openWorkspace } from '#/workspace/index.ts';

const CANDIDAT_ROW_SCHEMA = z.object({ id: z.string(), name: z.string() });

export type Candidat = z.infer<typeof CANDIDAT_ROW_SCHEMA>;

export type Actions = ReturnType<typeof createActions>;

// The single entry point of every feature: the CLI and the front only call these actions,
// so no business rule lives in either of them (ADR-0003).
export function createActions({ dataDirectory }: { dataDirectory: string }) {
  const database = openWorkspace(dataDirectory);

  return {
    listCandidats(): Candidat[] {
      const rowList = database.prepare('SELECT id, name FROM candidat ORDER BY name').all();
      return z.array(CANDIDAT_ROW_SCHEMA).parse(rowList);
    },
  };
}
