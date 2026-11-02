import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';

import { applyTo } from './apply.ts';
import { detectPostings as detectRecordedPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

function researchRun(title: string) {
  return { fileByName: { 'research.md': `# ${title}\n\n## Sources\n\n- https://www.justice.fr/\n` } };
}

const DRAFT = "Madame la Présidente,\n\nTitulaire d'un [à compléter : diplôme], je souhaite rejoindre le tribunal.\n";

const LETTER_RUN = {
  fileByName: {
    'draft.md': DRAFT,
    'recipients.json': JSON.stringify({
      to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
      ccList: [],
      salutation: { text: 'Madame la Présidente,', source: 'contact1' },
      justification: 'Le mail de candidature est celui de la présidence.',
    }),
  },
};

const CORRECTED_LETTER =
  "Madame la Présidente,\n\nTitulaire d'un master 2 de droit privé, je souhaite rejoindre le tribunal.\n";

// Launching a module only queues its job: the worker's turn is taken here
async function detectPostings(...plannedRunList: Parameters<typeof createFakeAiSession>) {
  const { actions } = await detectRecordedPostings(createFakeAiSession(...plannedRunList));
  return actions;
}

async function runModule(actions: Actions, module: string) {
  await actions.runModule({ module, reference: REFERENCE });
  await actions.runQueuedJobs();
}

async function readDocuments(actions: Actions, artifact: string) {
  const { artifactList } = await actions.readPosting({ reference: REFERENCE });
  return artifactList
    .find((artifactVersions) => artifactVersions.artifact === artifact)
    ?.versionList.map(({ version, documentList }) => ({
      number: version.number,
      documentList: documentList.map(({ fileName, markdown }) => ({ fileName, markdown })),
    }));
}

// For each Artifact with Versions, the files of each Version the Posting page offers to correct
async function readModifiableFiles(actions: Actions) {
  const { artifactList } = await actions.readPosting({ reference: REFERENCE });
  return artifactList
    .filter(({ versionList }) => versionList.length > 0)
    .map(({ artifact, versionList }) => ({
      artifact,
      fileNameList: versionList.map(({ documentList }) =>
        documentList.filter(({ isModifiable }) => isModifiable).map(({ fileName }) => fileName),
      ),
    }));
}

// For each Artifact with Versions, the numbers of those the Posting page offers to retain
async function readChoosableVersions(actions: Actions) {
  const { artifactList } = await actions.readPosting({ reference: REFERENCE });
  return artifactList
    .filter(({ versionList }) => versionList.length > 0)
    .map(({ artifact, versionList }) => ({
      artifact,
      numberList: versionList.filter(({ isChoosable }) => isChoosable).map(({ version }) => version.number),
    }));
}

describe('saving a correction', () => {
  it('corrects the Chosen Version of a Research in place, without creating a Version', async () => {
    const actions = await detectPostings(researchRun('Research v1'), researchRun('Research v2'));
    await runModule(actions, 'research');
    await runModule(actions, 'research');

    await actions.saveDocument({
      reference: REFERENCE,
      artifact: 'research',
      fileName: 'research.md',
      markdown: '# Recherche v2, corrigée\n',
    });

    expect(await readDocuments(actions, 'research')).toEqual([
      {
        number: 1,
        documentList: [{ fileName: 'research.md', markdown: researchRun('Research v1').fileByName['research.md'] }],
      },
      { number: 2, documentList: [{ fileName: 'research.md', markdown: '# Recherche v2, corrigée\n' }] },
    ]);
  });

  // The Draft stays as the AI wrote it, so that the tool learns from the corrections (spec « Letter »)
  it('corrects the Letter and refuses to touch its Draft', async () => {
    const actions = await detectPostings(researchRun('Recherche'), LETTER_RUN);
    await runModule(actions, 'research');
    await runModule(actions, 'letter');

    await actions.saveDocument({
      reference: REFERENCE,
      artifact: 'letter',
      fileName: 'letter.md',
      markdown: CORRECTED_LETTER,
    });
    await expect(
      actions.saveDocument({
        reference: REFERENCE,
        artifact: 'letter',
        fileName: 'draft.md',
        markdown: CORRECTED_LETTER,
      }),
    ).rejects.toThrow(/Le Brouillon ne se modifie jamais/);

    expect(await readDocuments(actions, 'letter')).toEqual([
      {
        number: 1,
        documentList: [
          { fileName: 'draft.md', markdown: DRAFT },
          { fileName: 'letter.md', markdown: CORRECTED_LETTER },
        ],
      },
    ]);
  });

  // The front opens an editor only where saveDocument accepts the file
  it('tells the Posting page which files can be corrected: those of the Chosen Versions, until the Letter is sent', async () => {
    const actions = await detectPostings(researchRun('Research v1'), researchRun('Research v2'), LETTER_RUN);
    await runModule(actions, 'research');
    await runModule(actions, 'research');
    await runModule(actions, 'letter');
    const beforeAppliedList = await readModifiableFiles(actions);

    await applyTo(actions, REFERENCE);

    expect(beforeAppliedList).toEqual([
      { artifact: 'research', fileNameList: [[], ['research.md']] },
      { artifact: 'letter', fileNameList: [['letter.md']] },
    ]);
    expect(await readModifiableFiles(actions)).toEqual([
      { artifact: 'research', fileNameList: [[], ['research.md']] },
      { artifact: 'letter', fileNameList: [[]] },
    ]);
  });

  // The front offers « Choose » only where chooseVersion accepts the Version
  it('tells the Posting page which Versions can become the Chosen Version, the Letter ones until it is sent', async () => {
    const actions = await detectPostings(
      researchRun('Research v1'),
      researchRun('Research v2'),
      { isSuccess: false },
      LETTER_RUN,
      LETTER_RUN,
    );
    await runModule(actions, 'research');
    await runModule(actions, 'research');
    await runModule(actions, 'research');
    await runModule(actions, 'letter');
    await runModule(actions, 'letter');
    const beforeAppliedList = await readChoosableVersions(actions);

    await applyTo(actions, REFERENCE);

    expect(beforeAppliedList).toEqual([
      { artifact: 'research', numberList: [1] },
      { artifact: 'letter', numberList: [1] },
    ]);
    expect(await readChoosableVersions(actions)).toEqual([
      { artifact: 'research', numberList: [1] },
      { artifact: 'letter', numberList: [] },
    ]);
  });
});
