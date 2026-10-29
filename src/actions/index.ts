import { z } from 'zod/v4';

import { CLAUDE_CODE, type IAiSession } from '#/ai-session/acl/claude-code.ts';
import type { Candidat, DomainValue } from '#/domain/index.ts';
import { composeProfilPrompt } from '#/profil/prompt.ts';
import { openWorkspace } from '#/workspace/index.ts';

export type Actions = Awaited<ReturnType<typeof createActions>>;

const PROFIL_INPUT_SCHEMA = z.object({ candidatId: z.string() });

// The single entry point of every feature: the CLI and the front only call these actions,
// so no business rule lives in either of them (ADR-0003). `satisfies` holds them to the
// anti-corruption layer (ADR-0005): the input is whatever a user typed, so each action takes it
// as unknown and parses it with Zod, and the output is nothing or domain values, so no raw data
// reaches the CLI or the front. The tests pass a fake aiSession, since Claude is an external boundary.
export async function createActions({
  dataDirectory,
  aiSession = CLAUDE_CODE,
}: {
  dataDirectory: string;
  aiSession?: IAiSession;
}) {
  const workspace = await openWorkspace(dataDirectory);

  return {
    listCandidats(): Promise<Candidat[]> {
      return workspace.listCandidats();
    },

    async openProfil(rawInput: unknown): Promise<void> {
      const { candidatId } = PROFIL_INPUT_SCHEMA.parse(rawInput);
      const candidatList = await workspace.listCandidats();
      const candidat = candidatList.find(({ id }) => id === candidatId);
      if (candidat === undefined) {
        throw new Error(`Candidat inconnu : ${candidatId}. « jf candidats » liste les Candidats.`);
      }
      aiSession.openInteractive({
        prompt: composeProfilPrompt(candidat),
        directory: workspace.profilDirectoryOf(candidat.id),
      });
    },
  } satisfies Record<string, (rawInput: unknown) => Promise<void> | Promise<DomainValue | DomainValue[]>>;
}
