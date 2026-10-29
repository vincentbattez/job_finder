import type { Candidat } from '#/domain/index.ts';
import { openWorkspace } from '#/workspace/index.ts';

export type Actions = Awaited<ReturnType<typeof createActions>>;

// The single entry point of every feature: the CLI and the front only call these actions,
// so no business rule lives in either of them (ADR-0003). Their input is whatever a user typed,
// so each action takes it as unknown and parses it with Zod: `satisfies` refuses any other
// input type (ADR-0005).
export async function createActions({ dataDirectory }: { dataDirectory: string }) {
  const workspace = await openWorkspace(dataDirectory);

  return {
    listCandidats(): Promise<Candidat[]> {
      return workspace.listCandidats();
    },
  } satisfies Record<string, (rawInput: unknown) => Promise<unknown>>;
}
