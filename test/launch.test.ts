import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createRecordedFetch } from './recorded-http.ts';

const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', 'config.example.json');

// The Béthune Offre of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RECHERCHE_RUN = {
  fileByName: { 'recherche.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

async function detectOffres(aiSession = createFakeAiSession()) {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  const actions = await createActions({ dataDirectory, aiSession, fetch: createRecordedFetch().fetch });
  await actions.detect();
  return actions;
}

async function readEtatByArtefact(actions: Actions) {
  const { artefactList } = await actions.readOffre({ reference: REFERENCE });
  return Object.fromEntries(artefactList.map(({ artefact, etat }) => [artefact, etat]));
}

describe('the état of each Artefact on the fiche of an Offre', () => {
  it('is absent, then en cours from the moment its job is queued, then prêt', async () => {
    const actions = await detectOffres(createFakeAiSession(RECHERCHE_RUN));
    const before = await readEtatByArtefact(actions);

    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    const queued = await readEtatByArtefact(actions);
    await actions.runQueuedJobs();

    expect(before).toEqual({
      recherche: 'absent',
      lettre: 'absent',
      fiche_entretien: 'absent',
      visualisation: 'absent',
    });
    expect(queued).toMatchObject({ recherche: 'en_cours', lettre: 'absent' });
    expect(await readEtatByArtefact(actions)).toMatchObject({ recherche: 'pret', lettre: 'absent' });
  });

  it('is en échec after a failed run, and en cours again once relaunched', async () => {
    const actions = await detectOffres(createFakeAiSession(RECHERCHE_RUN, { isSuccess: false }));
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();
    const failed = await readEtatByArtefact(actions);

    await actions.runModule({ module: 'recherche', reference: REFERENCE });

    expect(failed).toMatchObject({ recherche: 'en_echec' });
    expect(await readEtatByArtefact(actions)).toMatchObject({ recherche: 'en_cours' });
  });
});

async function readModuleByArtefact(actions: Actions) {
  const { artefactList } = await actions.readOffre({ reference: REFERENCE });
  return Object.fromEntries(artefactList.map(({ artefact, module }) => [artefact, module]));
}

describe('the modules the fiche of an Offre offers', () => {
  it('offers a module for each Artefact a module produces, held back while an input it needs is missing', async () => {
    const actions = await detectOffres(createFakeAiSession(RECHERCHE_RUN));
    const before = await readModuleByArtefact(actions);

    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();

    expect(before).toMatchObject({
      recherche: { refusal: null },
      lettre: { refusal: /^L'Offre 2026-2445600 n'a pas de Recherche retenue/ },
      fiche_entretien: null,
      visualisation: null,
    });
    expect(await readModuleByArtefact(actions)).toMatchObject({
      recherche: { refusal: null },
      lettre: { refusal: null },
    });
  });

  it('holds the Lettre back once the Offre is Postulée', async () => {
    const actions = await detectOffres(createFakeAiSession(RECHERCHE_RUN));
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();

    await actions.changeStatus({ reference: REFERENCE, status: 'postulee' });

    expect(await readModuleByArtefact(actions)).toMatchObject({
      recherche: { refusal: null },
      lettre: { refusal: /est Postulée : sa Lettre retenue est figée/ },
    });
  });
});
