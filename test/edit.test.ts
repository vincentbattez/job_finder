import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createRecordedFetch } from './recorded-http.ts';

const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', 'config.example.json');

// The Béthune Offre of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OFFRE_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RECHERCHE = {
  fileByName: {
    'recherche.md': '# Recherche\n\nLe tribunal pour enfants de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n',
  },
};

// Launching a module only queues its job: each test then lets the worker run the queue
async function detectOffres(aiSession: ReturnType<typeof createFakeAiSession>) {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  const actions = await createActions({ dataDirectory, aiSession, fetch: createRecordedFetch().fetch });
  await actions.detect();
  return { actions, offreDirectory: path.join(dataDirectory, 'candidats/lea/offres', OFFRE_DIRECTORY_NAME) };
}

describe('edit', () => {
  it("opens an interactive session in the Offre's folder, on the Version retenue of the Artefact", async () => {
    const aiSession = createFakeAiSession(RECHERCHE, RECHERCHE);
    const { actions, offreDirectory } = await detectOffres(aiSession);
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();
    await actions.retenirVersion({ reference: REFERENCE, artefact: 'recherche', number: 1 });

    await actions.openArtefact({ reference: REFERENCE, artefact: 'recherche' });

    expect(aiSession.interactiveSessionList.map(({ directory }) => directory)).toEqual([offreDirectory]);
    expect(aiSession.interactiveSessionList[0]?.prompt).toContain('`recherche/v1/`');
    expect(aiSession.interactiveSessionList[0]?.prompt).not.toContain('recherche/v2');
  });

  it('tells the session the Candidat, the Offre, its files and the rules', async () => {
    const aiSession = createFakeAiSession(RECHERCHE);
    const { actions } = await detectOffres(aiSession);
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();

    await actions.openArtefact({ reference: REFERENCE, artefact: 'recherche' });

    const prompt = aiSession.interactiveSessionList[0]?.prompt;
    expect(prompt).toContain('Léa');
    expect(prompt).toContain(
      '2026-2445600, « Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE »',
    );
    expect(prompt).toContain('`fiche-de-poste.md`');
    expect(prompt).toContain('Ne modifie jamais un Brouillon');
  });

  // The Brouillon stays as the AI wrote it, so that the tool learns from the corrections (spec « Lettre »)
  it('keeps every Brouillon of the Offre out of reach of the session', async () => {
    const aiSession = createFakeAiSession(RECHERCHE);
    const { actions, offreDirectory } = await detectOffres(aiSession);
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();

    await actions.openArtefact({ reference: REFERENCE, artefact: 'recherche' });

    expect(aiSession.interactiveSessionList[0]?.readOnlyPathList).toEqual([
      path.join(offreDirectory, '**', 'brouillon.md'),
    ]);
  });
});

describe('an edit refused', () => {
  // The Lettre retenue of a Postulée Offre is the one that was sent (spec « Versions »)
  it('refuses to edit the Lettre of a Postulée Offre, saying why, without opening a session', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await detectOffres(aiSession);
    await actions.changeStatus({ reference: REFERENCE, status: 'postulee' });

    await expect(actions.openArtefact({ reference: REFERENCE, artefact: 'lettre' })).rejects.toThrow(
      /L'Offre 2026-2445600 est Postulée : sa Lettre retenue est figée telle qu'envoyée/,
    );
    expect(aiSession.interactiveSessionList).toEqual([]);
  });

  it.each([
    { case: 'never produced', runCount: 0 },
    { case: 'whose only Version failed', runCount: 1 },
  ])('refuses an Artefact $case, without opening a session', async ({ runCount }) => {
    const aiSession = createFakeAiSession({});
    const { actions } = await detectOffres(aiSession);
    for (let run = 0; run < runCount; run += 1) {
      await actions.runModule({ module: 'recherche', reference: REFERENCE });
    }
    await actions.runQueuedJobs();

    await expect(actions.openArtefact({ reference: REFERENCE, artefact: 'recherche' })).rejects.toThrow(
      "L'Offre 2026-2445600 n'a pas de Version retenue de recherche à modifier : « jf run recherche 2026-2445600 » en produit une.",
    );
    expect(aiSession.interactiveSessionList).toEqual([]);
  });
});

describe('the Artefacts to edit', () => {
  it('lists the Version retenue of each Artefact of an Offre, for jf edit to offer them', async () => {
    const { actions } = await detectOffres(createFakeAiSession(RECHERCHE, RECHERCHE));
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();
    await actions.retenirVersion({ reference: REFERENCE, artefact: 'recherche', number: 1 });

    const versionList = await actions.listVersionsRetenues({ reference: REFERENCE });

    expect(versionList.map(({ artefact, number }) => ({ artefact, number }))).toEqual([
      { artefact: 'recherche', number: 1 },
    ]);
  });
});
