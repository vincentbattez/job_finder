import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';

import { detectOffres as detectRecordedOffres } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune Offre of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

function rechercheRun(title: string) {
  return { fileByName: { 'recherche.md': `# ${title}\n\n## Sources\n\n- https://www.justice.fr/\n` } };
}

const BROUILLON =
  "Madame la Présidente,\n\nTitulaire d'un [à compléter : diplôme], je souhaite rejoindre le tribunal.\n";

const LETTRE_RUN = {
  fileByName: {
    'brouillon.md': BROUILLON,
    'destinataires.json': JSON.stringify({
      to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
      ccList: [],
      salutation: { text: 'Madame la Présidente,', source: 'contact1' },
      justification: 'Le mail de candidature est celui de la présidence.',
    }),
  },
};

const CORRECTED_LETTRE =
  "Madame la Présidente,\n\nTitulaire d'un master 2 de droit privé, je souhaite rejoindre le tribunal.\n";

// Launching a module only queues its job: the worker's turn is taken here
async function detectOffres(...plannedRunList: Parameters<typeof createFakeAiSession>) {
  const { actions } = await detectRecordedOffres(createFakeAiSession(...plannedRunList));
  return actions;
}

async function runModule(actions: Actions, module: string) {
  await actions.runModule({ module, reference: REFERENCE });
  await actions.runQueuedJobs();
}

async function readDocuments(actions: Actions, artefact: string) {
  const { artefactList } = await actions.readOffre({ reference: REFERENCE });
  return artefactList
    .find((artefactVersions) => artefactVersions.artefact === artefact)
    ?.versionList.map(({ version, documentList }) => ({
      number: version.number,
      documentList: documentList.map(({ fileName, markdown }) => ({ fileName, markdown })),
    }));
}

// For each Artefact with Versions, the files of each Version the fiche offers to correct
async function readModifiableFiles(actions: Actions) {
  const { artefactList } = await actions.readOffre({ reference: REFERENCE });
  return artefactList
    .filter(({ versionList }) => versionList.length > 0)
    .map(({ artefact, versionList }) => ({
      artefact,
      fileNameList: versionList.map(({ documentList }) =>
        documentList.filter(({ isModifiable }) => isModifiable).map(({ fileName }) => fileName),
      ),
    }));
}

// For each Artefact with Versions, the numbers of those the fiche offers to retain
async function readRetenableVersions(actions: Actions) {
  const { artefactList } = await actions.readOffre({ reference: REFERENCE });
  return artefactList
    .filter(({ versionList }) => versionList.length > 0)
    .map(({ artefact, versionList }) => ({
      artefact,
      numberList: versionList.filter(({ isRetenable }) => isRetenable).map(({ version }) => version.number),
    }));
}

describe('saving a correction', () => {
  it('corrects the Version retenue of a Recherche in place, without creating a Version', async () => {
    const actions = await detectOffres(rechercheRun('Recherche v1'), rechercheRun('Recherche v2'));
    await runModule(actions, 'recherche');
    await runModule(actions, 'recherche');

    await actions.saveDocument({
      reference: REFERENCE,
      artefact: 'recherche',
      fileName: 'recherche.md',
      markdown: '# Recherche v2, corrigée\n',
    });

    expect(await readDocuments(actions, 'recherche')).toEqual([
      {
        number: 1,
        documentList: [{ fileName: 'recherche.md', markdown: rechercheRun('Recherche v1').fileByName['recherche.md'] }],
      },
      { number: 2, documentList: [{ fileName: 'recherche.md', markdown: '# Recherche v2, corrigée\n' }] },
    ]);
  });

  // The Brouillon stays as the AI wrote it, so that the tool learns from the corrections (spec « Lettre »)
  it('corrects the Lettre and refuses to touch its Brouillon', async () => {
    const actions = await detectOffres(rechercheRun('Recherche'), LETTRE_RUN);
    await runModule(actions, 'recherche');
    await runModule(actions, 'lettre');

    await actions.saveDocument({
      reference: REFERENCE,
      artefact: 'lettre',
      fileName: 'lettre.md',
      markdown: CORRECTED_LETTRE,
    });
    await expect(
      actions.saveDocument({
        reference: REFERENCE,
        artefact: 'lettre',
        fileName: 'brouillon.md',
        markdown: CORRECTED_LETTRE,
      }),
    ).rejects.toThrow(/Le Brouillon ne se modifie jamais/);

    expect(await readDocuments(actions, 'lettre')).toEqual([
      {
        number: 1,
        documentList: [
          { fileName: 'brouillon.md', markdown: BROUILLON },
          { fileName: 'lettre.md', markdown: CORRECTED_LETTRE },
        ],
      },
    ]);
  });

  // The Lettre retenue of a Postulée Offre is the one sent (spec « Versions »)
  it('refuses to correct the Lettre of a Postulée Offre', async () => {
    const actions = await detectOffres(rechercheRun('Recherche'), LETTRE_RUN);
    await runModule(actions, 'recherche');
    await runModule(actions, 'lettre');
    await actions.changeStatut({ reference: REFERENCE, statut: 'postulee' });

    await expect(
      actions.saveDocument({
        reference: REFERENCE,
        artefact: 'lettre',
        fileName: 'lettre.md',
        markdown: CORRECTED_LETTRE,
      }),
    ).rejects.toThrow(/L'Offre 2026-2445600 a été Postulée : sa Lettre retenue est figée/);

    expect(await readDocuments(actions, 'lettre')).toMatchObject([
      { documentList: [{ fileName: 'brouillon.md' }, { fileName: 'lettre.md', markdown: BROUILLON }] },
    ]);
  });

  it('writes only over a Markdown file of the Version retenue', async () => {
    const actions = await detectOffres(rechercheRun('Recherche'));
    await runModule(actions, 'recherche');
    const { ficheDePoste } = await actions.readOffre({ reference: REFERENCE });

    await expect(
      actions.saveDocument({
        reference: REFERENCE,
        artefact: 'recherche',
        fileName: '../../fiche-de-poste.md',
        markdown: '# Remplacée\n',
      }),
    ).rejects.toThrow(/« \.\.\/\.\.\/fiche-de-poste\.md » n'est pas un fichier de la Version retenue/);

    const after = await actions.readOffre({ reference: REFERENCE });
    expect(after.ficheDePoste).toBe(ficheDePoste);
  });

  it('refuses an Artefact without a Version retenue', async () => {
    const actions = await detectOffres();

    await expect(
      actions.saveDocument({ reference: REFERENCE, artefact: 'recherche', fileName: 'recherche.md', markdown: '' }),
    ).rejects.toThrow(/L'Offre 2026-2445600 n'a pas de Version retenue de recherche à modifier/);
  });

  // The front opens an editor only where saveDocument accepts the file
  it('tells the fiche which files can be corrected: those of the Versions retenues, until the Lettre is sent', async () => {
    const actions = await detectOffres(rechercheRun('Recherche v1'), rechercheRun('Recherche v2'), LETTRE_RUN);
    await runModule(actions, 'recherche');
    await runModule(actions, 'recherche');
    await runModule(actions, 'lettre');
    const beforePostuleeList = await readModifiableFiles(actions);

    await actions.changeStatut({ reference: REFERENCE, statut: 'postulee' });

    expect(beforePostuleeList).toEqual([
      { artefact: 'recherche', fileNameList: [[], ['recherche.md']] },
      { artefact: 'lettre', fileNameList: [['lettre.md']] },
    ]);
    expect(await readModifiableFiles(actions)).toEqual([
      { artefact: 'recherche', fileNameList: [[], ['recherche.md']] },
      { artefact: 'lettre', fileNameList: [[]] },
    ]);
  });

  // The front offers « Retenir » only where retenirVersion accepts the Version
  it('tells the fiche which Versions can become the Version retenue, the Lettre ones until it is sent', async () => {
    const actions = await detectOffres(
      rechercheRun('Recherche v1'),
      rechercheRun('Recherche v2'),
      { isSuccess: false },
      LETTRE_RUN,
      LETTRE_RUN,
    );
    await runModule(actions, 'recherche');
    await runModule(actions, 'recherche');
    await runModule(actions, 'recherche');
    await runModule(actions, 'lettre');
    await runModule(actions, 'lettre');
    const beforePostuleeList = await readRetenableVersions(actions);

    await actions.changeStatut({ reference: REFERENCE, statut: 'postulee' });

    expect(beforePostuleeList).toEqual([
      { artefact: 'recherche', numberList: [1] },
      { artefact: 'lettre', numberList: [1] },
    ]);
    expect(await readRetenableVersions(actions)).toEqual([
      { artefact: 'recherche', numberList: [1] },
      { artefact: 'lettre', numberList: [] },
    ]);
  });

  // The Visualisation is regenerated from the Fiche d'entretien, never corrected (spec « Modules IA »)
  it('refuses to correct a Visualisation by hand', async () => {
    const actions = await detectOffres();

    await expect(
      actions.saveDocument({
        reference: REFERENCE,
        artefact: 'visualisation',
        fileName: 'visualisation.md',
        markdown: '',
      }),
    ).rejects.toThrow(/La Visualisation ne se modifie pas à la main/);
  });
});
