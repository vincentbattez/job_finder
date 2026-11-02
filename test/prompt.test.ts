import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { DEFAULT_INSTRUCTIONS_EN } from '#/domain/catalogue/en/default-instructions.ts';
import { DEFAULT_INSTRUCTIONS_FR } from '#/domain/catalogue/fr/default-instructions.ts';
import type { Artifact } from '#/domain/index.ts';

import { detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { runAndValidate } from './run-module.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

// Another Béthune Posting of Léa, whose Letter she sent
const SENT_REFERENCE = '2026-2445609';

const RESEARCH_RUN = {
  fileByName: { 'research.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};
const LETTER_RUN = {
  fileByName: {
    'letter.md': 'Madame la Présidente,\n\nJe souhaite rejoindre le tribunal de Béthune.\n',
    'recipients.json': JSON.stringify({
      to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
      ccList: [],
      salutation: { text: 'Madame la Présidente,', source: 'contact1' },
      justification: 'Le mail de candidature est celui de la présidence.',
    }),
  },
};
// The Prompt the Posting page shows beside an Artifact of the Posting, or of its first Interview
async function readPrompt(actions: Actions, artifact: Artifact) {
  const { artifactList, interviewList } = await actions.readPosting({ reference: REFERENCE });
  return [...artifactList, ...(interviewList[0]?.artifactList ?? [])].find((entry) => entry.artifact === artifact)
    ?.module.prompt;
}

async function runModule(actions: Actions, module: Artifact, reference = REFERENCE) {
  await runAndValidate(actions, { module, reference });
}

// The Posting Applied, with a first Interview, which the Interview Brief prepares
async function addInterview(actions: Actions) {
  await actions.changeStatus({ reference: REFERENCE, status: 'applied' });
  await actions.addInterview({ reference: REFERENCE, start: '2026-11-19T14:00', place: 'Béthune', interviewers: '' });
}

describe('the Prompt beside an Artifact', () => {
  it('is the one the next run receives, but for the folder of the Version still to be created', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN);
    const { actions } = await detectPostings(aiSession);
    const prompt = await readPrompt(actions, 'research');

    await runAndValidate(actions, { module: 'research', reference: REFERENCE });

    const [session] = aiSession.headlessSessionList;
    expect(prompt?.fixedPart).toContain('`research/v<next>/research.md`');
    expect(prompt?.fixedPart.replaceAll('research/v<next>', 'research/v1')).toBe(session?.fixedPrompt);
    expect(prompt?.instructions).toBe(session?.instructions);
  });

  it('is, for a Letter reading a Letter sent for another Posting, the one its run receives', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, LETTER_RUN, RESEARCH_RUN, LETTER_RUN);
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'research', SENT_REFERENCE);
    await runModule(actions, 'letter', SENT_REFERENCE);
    await actions.changeStatus({ reference: SENT_REFERENCE, status: 'applied' });
    await runModule(actions, 'research');
    await actions.saveInstructions({ candidateId: 'lea', module: 'letter', instructions: 'Une page au plus.' });
    const prompt = await readPrompt(actions, 'letter');

    await runModule(actions, 'letter');

    const session = aiSession.headlessSessionList.at(-1);
    expect(prompt?.fixedPart.replaceAll('letter/v<next>', 'letter/v1')).toBe(session?.fixedPrompt);
    expect(prompt?.instructions).toBe('Une page au plus.');
    expect(prompt?.instructions).toBe(session?.instructions);
  });

  it("holds the Candidate's own Instructions once they replaced the default ones of their Locale", async () => {
    const { actions } = await detectPostings(createFakeAiSession());
    const byDefault = await readPrompt(actions, 'research');
    await actions.saveInstructions({ candidateId: 'lea', module: 'research', instructions: 'Cherche les audiences.' });
    const own = await readPrompt(actions, 'research');
    await actions.deleteInstructions({ candidateId: 'lea', module: 'research' });
    await actions.setCandidateLocale({ candidateId: 'lea', locale: 'en' });

    expect(byDefault?.instructions).toBe(DEFAULT_INSTRUCTIONS_FR.research);
    expect(own?.instructions).toBe('Cherche les audiences.');
    await expect(readPrompt(actions, 'research')).resolves.toMatchObject({
      instructions: DEFAULT_INSTRUCTIONS_EN.research,
    });
  });

  it('lists, for the Letter, the Chosen Research of the Posting and the Letters already sent', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, LETTER_RUN, RESEARCH_RUN));
    await runModule(actions, 'research', SENT_REFERENCE);
    await runModule(actions, 'letter', SENT_REFERENCE);
    await actions.changeStatus({ reference: SENT_REFERENCE, status: 'applied' });

    await runModule(actions, 'research');

    await expect(readPrompt(actions, 'letter')).resolves.toMatchObject({
      readVersionList: [
        { reference: REFERENCE, artifact: 'research', interviewNumber: null, number: 1 },
        { reference: SENT_REFERENCE, artifact: 'letter', interviewNumber: null, number: 1 },
      ],
    });
  });

  it('lists, for the Interview Brief without a Chosen Letter, only the Research', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN));
    await runModule(actions, 'research');

    await addInterview(actions);

    await expect(readPrompt(actions, 'interview_brief')).resolves.toMatchObject({
      readVersionList: [{ reference: REFERENCE, artifact: 'research', interviewNumber: null, number: 1 }],
    });
  });

  it('lists the Chosen Letter for the Interview Brief', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, LETTER_RUN));
    await runModule(actions, 'research');
    await runModule(actions, 'letter');
    await addInterview(actions);

    const briefPrompt = await readPrompt(actions, 'interview_brief');

    expect(briefPrompt?.readVersionList).toEqual([
      { reference: REFERENCE, artifact: 'research', interviewNumber: null, number: 1 },
      { reference: REFERENCE, artifact: 'letter', interviewNumber: null, number: 1 },
    ]);
  });

  it('is absent while the module is refused: a required Artifact missing, or the Letter frozen once Applied', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN));
    const withoutResearch = await readPrompt(actions, 'letter');
    await runModule(actions, 'research');

    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });

    expect(withoutResearch).toBeNull();
    expect(await readPrompt(actions, 'letter')).toBeNull();
    expect(await readPrompt(actions, 'research')).not.toBeNull();
  });
});
