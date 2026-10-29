import { openWorkspace } from '#/workspace/index.ts';

// Domain types: the database types never leave the actions (anti-corruption layer)
export type Candidat = { id: string; name: string };

export type Actions = Awaited<ReturnType<typeof createActions>>;

// The single entry point of every feature: the CLI and the front only call these actions,
// so no business rule lives in either of them (ADR-0003).
export async function createActions({ dataDirectory }: { dataDirectory: string }) {
  const database = await openWorkspace(dataDirectory);

  return {
    listCandidats(): Promise<Candidat[]> {
      return database.candidat.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
    },
  };
}
