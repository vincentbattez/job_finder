import { isDeepStrictEqual } from 'node:util';

import { z } from 'zod/v4';

import { catalogueOf } from '#/domain/catalogue/index.ts';
import type { Candidate, Watch } from '#/domain/index.ts';

import { PARAMETERS_INPUT_SCHEMA, type ActionContext } from './context.ts';

const WATCH_INPUT_SCHEMA = z.object({ watchId: z.string() });

// A field of the form left blank arrives empty, and counts as left out, as does an empty line of a list
const SAVE_INPUT_SCHEMA = z.object({
  watchId: z.string().optional(),
  source: z.string(),
  parameters: PARAMETERS_INPUT_SCHEMA.transform((parameters) =>
    Object.fromEntries(
      Object.entries(parameters)
        .map(([name, value]) => [name, Array.isArray(value) ? value.filter((item) => item !== '') : value] as const)
        .filter(([, value]) => value !== ''),
    ),
  ),
});

// Each Candidate sets their Watches in their Profile: the Source they follow and the Parameters it asks
// for, the form built from its descriptor (ADR-0010, ADR-0011)
export function createWatchActions({ workspace, findCandidate, findSource }: ActionContext) {
  async function findWatch(candidate: Candidate, rawInput: unknown): Promise<Watch> {
    const { watchId } = WATCH_INPUT_SCHEMA.parse(rawInput);
    const watchList = await workspace.listWatches(candidate.id);
    const watch = watchList.find(({ id }) => id === watchId);
    if (watch === undefined) {
      throw new Error(catalogueOf(candidate).error.unknownWatch(candidate.name, watchId));
    }
    return watch;
  }

  // Named after its Candidate and numbered, since its Parameters may change
  async function newWatchId(candidate: Candidate): Promise<string> {
    const allWatchList = await workspace.listWatches();
    const idSet = new Set(allWatchList.map(({ id }) => id));
    let number = allWatchList.filter(({ candidateId }) => candidateId === candidate.id).length + 1;
    while (idSet.has(`${candidate.id}-${String(number)}`)) {
      number += 1;
    }
    return `${candidate.id}-${String(number)}`;
  }

  return {
    async listWatches(rawInput: unknown): Promise<Watch[]> {
      const candidate = await findCandidate(rawInput);
      return workspace.listWatches(candidate.id);
    },

    // Creates a Watch, or changes the one named: it starts its first launch again once its Source or
    // its Parameters change, so the Postings already online trigger nothing (ADR-0011)
    async saveWatch(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const input = SAVE_INPUT_SCHEMA.parse(rawInput);
      const source = findSource(input.source, candidate.locale);
      const parameters = source.parseParameters(input.parameters, candidate.locale);
      if (input.watchId === undefined) {
        const id = await newWatchId(candidate);
        await workspace.createWatch({ id, candidateId: candidate.id, source: input.source, parameters });
        return;
      }
      const watch = await findWatch(candidate, rawInput);
      if (watch.source !== input.source || !isDeepStrictEqual(watch.parameters, parameters)) {
        await workspace.updateWatch(watch, { source: input.source, parameters });
      }
    },

    // Its Postings stay with the Candidate
    async deleteWatch(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      await workspace.deleteWatch(await findWatch(candidate, rawInput));
    },
  };
}
