import { z } from 'zod/v4';

import { DETECTION_SCHEMA, type Candidat, type Detection, type DomainValue, type Offre } from '#/domain/index.ts';
import { createPepSource } from '#/modules/source-pep/index.ts';
import { openWorkspace } from '#/workspace/index.ts';

export type Actions = Awaited<ReturnType<typeof createActions>>;

const LIST_OFFRES_INPUT_SCHEMA = z.object({ candidatId: z.string() });

// The single entry point of every feature: the CLI and the front only call these actions,
// so no business rule lives in either of them (ADR-0003). `satisfies` holds them to the
// anti-corruption layer (ADR-0005): the input is whatever a user typed, so each action takes it
// as unknown and parses it with Zod, and the output is nothing or domain values, so no raw data
// reaches the CLI or the front. The tests replace the HTTP of the Sources through `fetch`.
export async function createActions({
  dataDirectory,
  fetch,
}: {
  dataDirectory: string;
  fetch?: typeof globalThis.fetch;
}) {
  const workspace = await openWorkspace(dataDirectory);
  const pepSource = createPepSource(fetch);

  return {
    listCandidats(): Promise<Candidat[]> {
      return workspace.listCandidats();
    },

    // Reads the Source of each Veille and records the Offres never seen before, with their Fiche
    // de poste. An Offre is known by its reference, never by its publication date, which the site
    // changes (ADR-0001). The first launch imports the Offres already online.
    async detect(): Promise<Detection[]> {
      const veilleList = await workspace.listVeilles();
      const detectionList: Detection[] = [];
      for (const veille of veilleList) {
        const { candidatId, source } = veille;
        const knownReferenceList = await workspace.listReferences(candidatId, source);
        const { matchingList, nearMissList } = await pepSource.search(veille.criteria);
        const newOffreList: Offre[] = [];
        for (const listedOffre of matchingList) {
          if (knownReferenceList.includes(listedOffre.reference)) {
            continue;
          }
          const { fiche, isInZone } = await pepSource.readFiche(listedOffre.reference, veille.zone);
          newOffreList.push(await workspace.saveOffre({ candidatId, source, listedOffre, fiche, isInZone }));
        }
        detectionList.push(
          DETECTION_SCHEMA.parse({
            veilleId: veille.id,
            candidatId,
            isFirstLaunch: knownReferenceList.length === 0,
            newOffreList,
            nearMissList,
          }),
        );
      }
      return detectionList;
    },

    async listOffres(rawInput: unknown): Promise<Offre[]> {
      const { candidatId } = LIST_OFFRES_INPUT_SCHEMA.parse(rawInput);
      const candidatList = await workspace.listCandidats();
      if (candidatList.every(({ id }) => id !== candidatId)) {
        throw new Error(`Candidat inconnu : ${candidatId}. Les Candidats sont déclarés dans config.json.`);
      }
      return workspace.listOffres(candidatId);
    },
  } satisfies Record<string, (rawInput: unknown) => Promise<void> | Promise<DomainValue | DomainValue[]>>;
}
