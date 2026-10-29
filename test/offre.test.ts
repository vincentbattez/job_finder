import { describe, expect, it } from 'vitest';

import { detectOffres } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune Offre of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RECHERCHE = '# Recherche : le tribunal pour enfants de Béthune\n\n## Sources\n\n- https://www.justice.fr/\n';

const RECIPIENTS = {
  to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
  ccList: [{ email: 'sec.p.tj-bethune@justice.fr', source: 'contact2' }],
  salutation: { text: 'Madame la Présidente,', source: 'contact1' },
  justification: 'Le mail de candidature est celui de la présidence ; le contact 2 demande le secrétariat en copie.',
};

describe('the fiche of an Offre', () => {
  it('reads an Offre with its raw contacts and its Fiche de poste', async () => {
    const { actions } = await detectOffres();

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
    const { actions } = await detectOffres(
      createFakeAiSession({ fileByName: { 'recherche.md': RECHERCHE } }, { isSuccess: false }),
    );
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();

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
        documentList: [{ fileName: 'recherche.md', markdown: RECHERCHE }],
      },
      { version: { number: 2, state: 'failed', isRetenue: false }, documentList: [] },
    ]);
    expect(artefactList[1]?.versionList).toEqual([]);
  });

  it('reads the recipients the Lettre retenue recommends, none before it exists', async () => {
    const { actions } = await detectOffres(
      createFakeAiSession(
        { fileByName: { 'recherche.md': RECHERCHE } },
        { fileByName: { 'brouillon.md': 'Madame la Présidente,\n', 'destinataires.json': JSON.stringify(RECIPIENTS) } },
      ),
    );
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runQueuedJobs();
    const before = await actions.readOffre({ reference: REFERENCE });
    await actions.runModule({ module: 'lettre', reference: REFERENCE });
    await actions.runQueuedJobs();

    const { recipients } = await actions.readOffre({ reference: REFERENCE });

    expect(before.recipients).toBeNull();
    expect(recipients).toEqual(RECIPIENTS);
  });

  it('refuses an unknown reference', async () => {
    const { actions } = await detectOffres();

    await expect(actions.readOffre({ reference: '2026-0000000' })).rejects.toThrow('Offre inconnue : 2026-0000000');
  });
});
