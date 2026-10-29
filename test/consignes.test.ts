import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';
import { FICHE_ENTRETIEN_DEFAULT_CONSIGNES } from '#/modules/fiche-entretien/consignes.ts';
import { LETTRE_DEFAULT_CONSIGNES } from '#/modules/lettre/consignes.ts';
import { RECHERCHE_DEFAULT_CONSIGNES } from '#/modules/recherche/consignes.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createRecordedFetch } from './recorded-http.ts';

const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', 'config.example.json');

// The Béthune Offre of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RECHERCHE_RUN = {
  fileByName: { 'recherche.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

async function openActions(aiSession = createFakeAiSession()) {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  return createActions({ dataDirectory, aiSession, fetch: createRecordedFetch().fetch });
}

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runRecherche(actions: Actions) {
  await actions.runModule({ module: 'recherche', reference: REFERENCE });
  await actions.runQueuedJobs();
}

describe('consignes', () => {
  it('shows the default Consignes of each module, and none of the Candidat yet', async () => {
    const actions = await openActions();

    const consignesList = await actions.listConsignes({ candidatId: 'lea' });

    expect(consignesList).toEqual([
      { module: 'recherche', defaultConsignes: RECHERCHE_DEFAULT_CONSIGNES, candidatConsignes: null },
      { module: 'lettre', defaultConsignes: LETTRE_DEFAULT_CONSIGNES, candidatConsignes: null },
      { module: 'fiche_entretien', defaultConsignes: FICHE_ENTRETIEN_DEFAULT_CONSIGNES, candidatConsignes: null },
    ]);
  });

  it("creates the Candidat's own Consignes for a module, then modifies them", async () => {
    const actions = await openActions();

    await actions.saveConsignes({ candidatId: 'lea', module: 'lettre', consignes: 'Une lettre courte.\n' });
    await actions.saveConsignes({ candidatId: 'lea', module: 'lettre', consignes: 'Une lettre très courte.\n' });

    expect(await actions.listConsignes({ candidatId: 'lea' })).toEqual([
      { module: 'recherche', defaultConsignes: RECHERCHE_DEFAULT_CONSIGNES, candidatConsignes: null },
      { module: 'lettre', defaultConsignes: LETTRE_DEFAULT_CONSIGNES, candidatConsignes: 'Une lettre très courte.\n' },
      { module: 'fiche_entretien', defaultConsignes: FICHE_ENTRETIEN_DEFAULT_CONSIGNES, candidatConsignes: null },
    ]);
  });

  it("goes back to the default Consignes once the Candidat's own are deleted", async () => {
    const actions = await openActions();
    await actions.saveConsignes({ candidatId: 'lea', module: 'recherche', consignes: 'Creuse la ville.\n' });

    await actions.deleteConsignes({ candidatId: 'lea', module: 'recherche' });

    const [recherche] = await actions.listConsignes({ candidatId: 'lea' });
    expect(recherche).toEqual({
      module: 'recherche',
      defaultConsignes: RECHERCHE_DEFAULT_CONSIGNES,
      candidatConsignes: null,
    });
  });

  it("tells for each Version whether it comes from the default Consignes or the Candidat's own", async () => {
    const actions = await openActions(createFakeAiSession(RECHERCHE_RUN, RECHERCHE_RUN));
    await actions.detect();

    await runRecherche(actions);
    await actions.saveConsignes({ candidatId: 'lea', module: 'recherche', consignes: 'Creuse la ville.\n' });
    await runRecherche(actions);

    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    expect(
      versionList.map(({ number, consignes, hasCandidatConsignes }) => ({ number, consignes, hasCandidatConsignes })),
    ).toEqual([
      { number: 1, consignes: RECHERCHE_DEFAULT_CONSIGNES, hasCandidatConsignes: false },
      { number: 2, consignes: 'Creuse la ville.\n', hasCandidatConsignes: true },
    ]);
  });

  it.each(['visualisation', 'inconnu'])(
    'refuses Consignes for « %s », not an available module, and keeps none',
    async (module) => {
      const actions = await openActions();

      await expect(actions.saveConsignes({ candidatId: 'lea', module, consignes: 'Courte.\n' })).rejects.toThrow(
        new RegExp(String.raw`Module inconnu : ${module}\. Modules : recherche, lettre, fiche\.`),
      );
      expect(await actions.listConsignes({ candidatId: 'lea' })).toMatchObject([
        { candidatConsignes: null },
        { candidatConsignes: null },
        { candidatConsignes: null },
      ]);
    },
  );

  it('refuses the Consignes of an unknown Candidat', async () => {
    const actions = await openActions();

    await expect(actions.listConsignes({ candidatId: 'vincent' })).rejects.toThrow(/Candidat inconnu : vincent/);
  });
});
