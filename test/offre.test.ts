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

async function detectOffres(aiSession = createFakeAiSession()) {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  const actions = await createActions({ dataDirectory, aiSession, fetch: createRecordedFetch().fetch });
  await actions.detect();
  return actions;
}

describe('the fiche of an Offre', () => {
  it('reads an Offre with its raw contacts and its Fiche de poste', async () => {
    const actions = await detectOffres();

    const { offre, ficheDePoste } = await actions.readOffre({ reference: REFERENCE });

    expect(offre).toMatchObject({
      reference: REFERENCE,
      applicationEmail: 'p.tj-bethune@justice.fr',
      contact1: 'Madame Odile SIMART, présidente du Tribunal Judiciaire de Béthune',
      contact2: 'secrétariat en copie : sec.p.tj-bethune@justice.fr',
    });
    expect(ficheDePoste).toContain(
      'La présente fiche de poste concerne une affectation auprès du tribunal pour enfants.',
    );
  });

  it('reads every Version of each Artefact with its files, and tells the Version retenue', async () => {
    const recherche = '# Recherche : le tribunal pour enfants de Béthune\n\n## Sources\n\n- https://www.justice.fr/\n';
    const actions = await detectOffres(
      createFakeAiSession({ fileByName: { 'recherche.md': recherche } }, { isSuccess: false }),
    );
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: REFERENCE });

    const { artefactList } = await actions.readOffre({ reference: REFERENCE });

    expect(artefactList.map(({ artefact }) => artefact)).toEqual([
      'recherche',
      'lettre',
      'fiche_entretien',
      'visualisation',
    ]);
    expect(artefactList[0]?.versionList).toMatchObject([
      {
        version: { number: 1, state: 'ready', isRetenue: true },
        documentList: [{ fileName: 'recherche.md', markdown: recherche }],
      },
      { version: { number: 2, state: 'failed', isRetenue: false }, documentList: [] },
    ]);
    expect(artefactList[1]?.versionList).toEqual([]);
  });

  it('refuses an unknown reference', async () => {
    const actions = await detectOffres();

    await expect(actions.readOffre({ reference: '2026-0000000' })).rejects.toThrow('Offre inconnue : 2026-0000000');
  });
});
