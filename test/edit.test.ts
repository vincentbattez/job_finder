import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectPostings as detectRecordedPostings, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const POSTING_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RESEARCH = {
  fileByName: {
    'research.md': '# Recherche\n\nLe tribunal pour enfants de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n',
  },
};

// A Letter Version as the Letter module writes it: the Draft and the recommended recipients
const LETTER = {
  fileByName: {
    'draft.md': 'Madame la Présidente,\n\nJe souhaite rejoindre le tribunal pour enfants de Béthune.\n',
    'recipients.json': JSON.stringify({
      to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
      ccList: [],
      salutation: { text: 'Madame la Présidente,', source: 'contact1' },
      justification: 'Le mail de candidature est celui de la présidence.',
    }),
  },
};

// Launching a module only queues its job: each test then lets the worker run the queue
async function detectPostings(aiSession: ReturnType<typeof createFakeAiSession>) {
  const { actions, dataDirectory } = await detectRecordedPostings(aiSession);
  return { actions, postingDirectory: path.join(dataDirectory, LEA_POSTINGS_PATH, POSTING_DIRECTORY_NAME) };
}

describe('edit', () => {
  it("opens an interactive session in the Posting's folder, on the Chosen Version of the Artifact", async () => {
    const aiSession = createFakeAiSession(RESEARCH, RESEARCH);
    const { actions, postingDirectory } = await detectPostings(aiSession);
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'research', number: 1 });

    await actions.openArtifact({ reference: REFERENCE, artifact: 'research' });

    expect(aiSession.interactiveSessionList.map(({ directory }) => directory)).toEqual([postingDirectory]);
    expect(aiSession.interactiveSessionList[0]?.prompt).toContain('`research/v1/`');
    expect(aiSession.interactiveSessionList[0]?.prompt).not.toContain('research/v2');
  });

  it('tells the session the Candidate, the Posting, its files and the rules', async () => {
    const aiSession = createFakeAiSession(RESEARCH);
    const { actions } = await detectPostings(aiSession);
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();

    await actions.openArtifact({ reference: REFERENCE, artifact: 'research' });

    const prompt = aiSession.interactiveSessionList[0]?.prompt;
    expect(prompt).toContain('Léa');
    expect(prompt).toContain(
      '2026-2445600, "Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE"',
    );
    expect(prompt).toContain('`job-description.md`');
    expect(prompt).toContain('Never modify a Draft');
    expect(prompt).toContain('Talk with Léa in French.');
    expect(prompt).toContain('Keep the Research in its own language, that of the Job Description');
  });

  // The Draft stays as the AI wrote it, so that the tool learns from the corrections (spec « Letter »)
  it('keeps every Draft of the Posting out of reach of the session', async () => {
    const aiSession = createFakeAiSession(RESEARCH);
    const { actions, postingDirectory } = await detectPostings(aiSession);
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();

    await actions.openArtifact({ reference: REFERENCE, artifact: 'research' });

    expect(aiSession.interactiveSessionList[0]?.readOnlyPathList).toEqual([
      path.join(postingDirectory, '**', 'draft.md'),
    ]);
  });

  // The Candidate corrects the Letter, never its Draft (spec « Versions »)
  it('opens the Chosen Letter of a Version from the Letter module, never its Draft', async () => {
    const aiSession = createFakeAiSession(RESEARCH, LETTER, LETTER);
    const { actions, postingDirectory } = await detectPostings(aiSession);
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();
    await actions.runModule({ module: 'letter', reference: REFERENCE });
    await actions.runModule({ module: 'letter', reference: REFERENCE });
    await actions.runQueuedJobs();
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'letter', number: 1 });

    await actions.openArtifact({ reference: REFERENCE, artifact: 'letter' });

    const { prompt = '', readOnlyPathList = [] } = aiSession.interactiveSessionList[0] ?? {};
    expect(prompt).toContain('The Letter to correct is `letter/v1/letter.md`');
    expect(prompt).not.toContain('letter/v2');
    const isReadOnly = (filePath: string) => readOnlyPathList.some((pattern) => path.matchesGlob(filePath, pattern));
    expect(isReadOnly(path.join(postingDirectory, 'letter/v1/draft.md'))).toBe(true);
    expect(isReadOnly(path.join(postingDirectory, 'letter/v1/letter.md'))).toBe(false);
  });
});

describe('an edit refused', () => {
  // The Chosen Letter of an Applied Posting is the one that was sent (spec « Versions »)
  it('refuses to edit the Letter of an Applied Posting, saying why, without opening a session', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await detectPostings(aiSession);
    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });

    await expect(actions.openArtifact({ reference: REFERENCE, artifact: 'letter' })).rejects.toThrow(
      /L'Offre 2026-2445600 a été Postulée : sa Lettre retenue est figée telle qu'envoyée/,
    );
    expect(aiSession.interactiveSessionList).toEqual([]);
  });
});

describe('the Artifacts to edit', () => {
  it('lists the Chosen Version of each Artifact of a Posting, for jf edit to offer them', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH, RESEARCH));
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'research', number: 1 });

    const versionList = await actions.listChosenVersions({ reference: REFERENCE });

    expect(versionList.map(({ artifact, number }) => ({ artifact, number }))).toEqual([
      { artifact: 'research', number: 1 },
    ]);
  });
});
