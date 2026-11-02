import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';

import { applyTo } from './apply.ts';
import { detectPostings as detectRecordedPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { runAndValidate } from './run-module.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

function researchRun(title: string) {
  return { fileByName: { 'research.md': `# ${title}\n\n## Sources\n\n- https://www.justice.fr/\n` } };
}

const DRAFT = "Madame la Présidente,\n\nTitulaire d'un [à compléter : diplôme], je souhaite rejoindre le tribunal.\n";

const LETTER_RUN = {
  fileByName: {
    'letter.md': DRAFT,
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
  return runAndValidate(actions, { module, reference: REFERENCE });
}

// Each Version's text and Original, as the Posting page reads them
async function readTexts(actions: Actions, artifact: string) {
  const { artifactList } = await actions.readPosting({ reference: REFERENCE });
  return artifactList
    .find((artifactVersions) => artifactVersions.artifact === artifact)
    ?.versionList.map(({ version, text, original }) => ({ number: version.number, text, original }));
}

// For each Artifact with Versions, the numbers of those the Posting page offers to correct and to validate
async function readOffers(actions: Actions) {
  const { artifactList } = await actions.readPosting({ reference: REFERENCE });
  return artifactList
    .filter(({ versionList }) => versionList.length > 0)
    .map(({ artifact, versionList }) => ({
      artifact,
      correctable: versionList.filter(({ isCorrectable }) => isCorrectable).map(({ version }) => version.number),
      validatable: versionList.filter(({ isValidatable }) => isValidatable).map(({ version }) => version.number),
    }));
}

describe('saving a correction', () => {
  it('corrects a Version of a Research in place, without creating a Version, its Original kept', async () => {
    const actions = await detectPostings(researchRun('Research v1'), researchRun('Research v2'));
    await runModule(actions, 'research');
    await runModule(actions, 'research');

    await actions.saveDocument({
      reference: REFERENCE,
      artifact: 'research',
      number: '1',
      fileName: 'research.md',
      markdown: '# Recherche v1, corrigée\n',
    });

    const v1 = researchRun('Research v1').fileByName['research.md'];
    const v2 = researchRun('Research v2').fileByName['research.md'];
    expect(await readTexts(actions, 'research')).toEqual([
      { number: 1, text: '# Recherche v1, corrigée\n', original: v1 },
      { number: 2, text: v2, original: v2 },
    ]);
  });

  // The Original stays as the AI wrote it, so that the tool learns from the corrections (ADR-0019)
  it('corrects the Letter and refuses to touch its Original', async () => {
    const actions = await detectPostings(researchRun('Recherche'), LETTER_RUN);
    await runModule(actions, 'research');
    await runModule(actions, 'letter');

    await actions.saveDocument({
      reference: REFERENCE,
      artifact: 'letter',
      number: 1,
      fileName: 'letter.md',
      markdown: CORRECTED_LETTER,
    });
    await expect(
      actions.saveDocument({
        reference: REFERENCE,
        artifact: 'letter',
        number: 1,
        fileName: 'original.md',
        markdown: CORRECTED_LETTER,
      }),
    ).rejects.toThrow(/L'Original ne se modifie jamais/);

    expect(await readTexts(actions, 'letter')).toEqual([{ number: 1, text: CORRECTED_LETTER, original: DRAFT }]);
  });

  // The front offers to correct and to validate only where the actions accept it
  it('tells the Posting page which Versions can be corrected and validated, the Letter ones until it is sent', async () => {
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
    await actions.runModule({ module: 'letter', reference: REFERENCE });
    await actions.runQueuedJobs();
    const beforeAppliedList = await readOffers(actions);

    await applyTo(actions, REFERENCE);

    expect(beforeAppliedList).toEqual([
      { artifact: 'research', correctable: [1, 2], validatable: [1] },
      { artifact: 'letter', correctable: [1, 2], validatable: [2] },
    ]);
    expect(await readOffers(actions)).toEqual([
      { artifact: 'research', correctable: [1, 2], validatable: [1] },
      { artifact: 'letter', correctable: [], validatable: [] },
    ]);
  });

  // Marking Applied while the latest Letter is a Draft validates it first, so the Letter sent is recorded
  it('validates the Letter then marks the Posting Applied, the Letter frozen from then on', async () => {
    const actions = await detectPostings(researchRun('Recherche'), LETTER_RUN);
    await runModule(actions, 'research');
    await actions.runModule({ module: 'letter', reference: REFERENCE });
    await actions.runQueuedJobs();

    await actions.keep({ reference: REFERENCE });
    await actions.changeStatus({ reference: REFERENCE, status: 'applied', letterNumber: '1' });

    const { posting } = await actions.readPosting({ reference: REFERENCE });
    expect(posting.status).toBe('applied');
    expect(await actions.listVersions({ reference: REFERENCE, artifact: 'letter' })).toEqual([
      expect.objectContaining({ number: 1, validation: 'validated', isChosen: true }),
    ]);
  });

  it('refuses a Letter to validate with any other Status', async () => {
    const actions = await detectPostings();

    await expect(
      actions.changeStatus({ reference: REFERENCE, status: 'to_apply', letterNumber: '1' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });
});
