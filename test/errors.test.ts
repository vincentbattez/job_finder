import { rmSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectOffres } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune Offre of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RECHERCHE_RUN = {
  fileByName: { 'recherche.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

// An error stops the command and says, in French, what to do (CODING_STANDARDS « Échec visible »)
describe('an error', () => {
  it.each([
    { command: 'jf versions', call: 'listVersions' },
    { command: 'jf edit', call: 'openArtefact' },
    { command: 'jf retenir', call: 'retenirVersion' },
  ] as const)('names the Artefacts when $command gets a mistyped one', async ({ call }) => {
    const { actions } = await detectOffres();

    await expect(actions[call]({ reference: REFERENCE, artefact: 'lettr', number: '1' })).rejects.toThrow(
      'Artefact inconnu : lettr. Artefacts : recherche, lettre, fiche, visualisation.',
    );
  });

  it('takes the alias of an Artefact, as jf run does', async () => {
    const { actions } = await detectOffres(createFakeAiSession(RECHERCHE_RUN));

    expect(await actions.listVersions({ reference: REFERENCE, artefact: 'fiche' })).toEqual([]);
  });

  it('tells where to find the Versions of an Artefact when one is unknown', async () => {
    const { actions } = await detectOffres(createFakeAiSession(RECHERCHE_RUN));
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();

    await expect(actions.retenirVersion({ reference: REFERENCE, artefact: 'recherche', number: 9 })).rejects.toThrow(
      `Version inconnue : recherche v9 de l'Offre ${REFERENCE}. « jf versions ${REFERENCE} recherche » liste ses Versions.`,
    );
  });

  it('tells where the number of a job comes from when it is unknown', async () => {
    const { actions } = await detectOffres();

    await expect(actions.followJob({ jobId: 999 })).rejects.toThrow(
      'Job inconnu : 999. Son numéro est celui que « jf run » ou « jf import » a affiché.',
    );
  });

  it('tells how to bring back a Fiche de poste missing from the folder of its Offre', async () => {
    const { actions, dataDirectory } = await detectOffres();
    const offreDirectory = path.join(
      dataDirectory,
      'candidats/lea/offres',
      '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune',
    );
    rmSync(path.join(offreDirectory, 'fiche-de-poste.md'));

    await expect(actions.readOffre({ reference: REFERENCE })).rejects.toThrow(
      `Fiche de poste introuvable pour l'Offre ${REFERENCE} : ${path.join(offreDirectory, 'fiche-de-poste.md')}. La remettre à cet emplacement, d'où l'outil la lit.`,
    );
  });
});
