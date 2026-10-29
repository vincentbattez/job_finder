import type { Candidat, DomainValue } from '#/domain/index.ts';
import { openWorkspace } from '#/workspace/index.ts';

export type Actions = Awaited<ReturnType<typeof createActions>>;

// The single entry point of every feature: the CLI and the front only call these actions,
// so no business rule lives in either of them (ADR-0003). `satisfies` holds them to the
// anti-corruption layer (ADR-0005): the input is whatever a user typed, so each action takes it
// as unknown and parses it with Zod, and the output is nothing or domain values, so no raw data
// reaches the CLI or the front.
export async function createActions({ dataDirectory }: { dataDirectory: string }) {
  const workspace = await openWorkspace(dataDirectory);

  return {
    listCandidats(): Promise<Candidat[]> {
      return workspace.listCandidats();
    },
  } satisfies Record<string, (rawInput: unknown) => Promise<void> | Promise<DomainValue | DomainValue[]>>;
}
