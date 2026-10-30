import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS } from '#/modules/interview-brief/instructions.ts';

import { detectPostings as detectRecordedPostings, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune Posting of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const POSTING_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RESEARCH_RUN = {
  fileByName: {
    'research.md':
      '# Recherche\n\nLe TJ de Béthune ([justice.fr](https://www.justice.fr/)).\n\n## Sources\n\n- https://www.justice.fr/\n',
  },
};

// A Letter Version of the Béthune Posting, its recipients taken from the fields of the Posting
const LETTER_RUN = {
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

const INTERVIEW_BRIEF = `# Fiche d'entretien : tribunal pour enfants de Béthune

## À réviser

- L'assistance éducative et le code de la justice pénale des mineurs.

## Moyens mnémotechniques

- « PAS » : Protéger, Accompagner, Sanctionner.

## Présentez-vous

Titulaire d'un [à compléter : diplôme et année d'obtention], je souhaite rejoindre le tribunal pour enfants.

## Questions probables

- Pourquoi le tribunal pour enfants de Béthune ?
`;

function briefRun(markdown = INTERVIEW_BRIEF) {
  return { fileByName: { 'interview-brief.md': markdown } };
}

async function detectPostings(aiSession: ReturnType<typeof createFakeAiSession>) {
  const { actions, dataDirectory } = await detectRecordedPostings(aiSession);
  return {
    actions,
    dataDirectory,
    postingDirectory: path.join(dataDirectory, LEA_POSTINGS_PATH, POSTING_DIRECTORY_NAME),
  };
}

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runModule(actions: Actions, module: string) {
  const { id } = await actions.runModule({ module, reference: REFERENCE });
  await actions.runQueuedJobs();
  return actions.followJob({ jobId: id });
}

describe('interview brief', () => {
  it('produces a new Version at each launch of jf run brief, the latest one chosen', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun(), briefRun());
    const { actions, postingDirectory } = await detectPostings(aiSession);
    await runModule(actions, 'research');

    const job = await runModule(actions, 'brief');
    await runModule(actions, 'brief');

    expect(job).toMatchObject({ module: 'interview_brief', state: 'done' });
    expect(job.version).toMatchObject({ artifact: 'interview_brief', number: 1, state: 'ready' });
    expect(readFileSync(path.join(postingDirectory, 'interview_brief/v1/interview-brief.md'), 'utf8')).toBe(
      INTERVIEW_BRIEF,
    );
    const versionList = await actions.listVersions({ reference: REFERENCE, artifact: 'interview_brief' });
    expect(versionList.map(({ number, isChosen }) => ({ number, isChosen }))).toEqual([
      { number: 1, isChosen: false },
      { number: 2, isChosen: true },
    ]);
  });

  it('refuses to run without a Chosen Research, before queuing anything', async () => {
    const { actions } = await detectPostings(createFakeAiSession({ isSuccess: false }));
    await runModule(actions, 'research');

    const launch = actions.runModule({ module: 'brief', reference: REFERENCE });

    await expect(launch).rejects.toThrow(
      "L'Offre 2026-2445600 n'a pas de Recherche retenue, sur laquelle s'appuie la Fiche d’entretien. La produire d'abord : jf run research 2026-2445600.",
    );
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  // The interview comes once the Letter is sent: the Interview Brief prepares the questions on it
  it('reads the Job Description, the Chosen Research, the Profile and the Chosen Letter, the one sent', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, RESEARCH_RUN, LETTER_RUN, briefRun());
    const { actions, dataDirectory, postingDirectory } = await detectPostings(aiSession);
    await runModule(actions, 'research');
    await runModule(actions, 'research');
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'research', number: 1 });
    await runModule(actions, 'letter');
    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });

    const { version } = await runModule(actions, 'brief');

    const profileDirectory = path.join(dataDirectory, 'candidates/lea/profile');
    const session = aiSession.headlessSessionList.at(-1);
    // The folder of the Posting is the session's own: only the folders outside it are added
    expect(session?.readDirectoryList).toEqual([profileDirectory]);
    expect(session?.fixedPrompt).toContain('`job-description.md`');
    expect(session?.fixedPrompt).toContain(`\`${path.join(postingDirectory, 'research/v1/research.md')}\``);
    expect(session?.fixedPrompt).toContain(`\`${profileDirectory}\``);
    expect(session?.fixedPrompt).toContain(`\`${path.join(postingDirectory, 'letter/v1/letter.md')}\``);
    expect(version?.inputList).toEqual([
      { artifact: 'research', number: 1, posting: { reference: REFERENCE } },
      { artifact: 'letter', number: 1, posting: { reference: REFERENCE } },
    ]);
  });

  it('runs without a Letter, and tells the session there is none', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun());
    const { actions, dataDirectory } = await detectPostings(aiSession);
    await runModule(actions, 'research');

    const { state, version } = await runModule(actions, 'brief');

    expect(state).toBe('done');
    const session = aiSession.headlessSessionList.at(-1);
    expect(session?.readDirectoryList).toEqual([path.join(dataDirectory, 'candidates/lea/profile')]);
    expect(session?.fixedPrompt).toContain("Le Candidat n'a pas de Lettre pour cette Offre");
    expect(session?.fixedPrompt).not.toContain('letter.md');
    expect(version?.inputList).toEqual([{ artifact: 'research', number: 1, posting: { reference: REFERENCE } }]);
  });
});

describe('the prompt of the Interview Brief', () => {
  it('asks for a Fiche organised to revise and train, without inventing a fact on the Candidate', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun());
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'research');

    const { version } = await runModule(actions, 'brief');

    const { fixedPrompt, instructions } = aiSession.headlessSessionList[1] ?? {};
    // The plan is the default Instructions': the Candidate's own may organise the Interview Brief otherwise
    for (const section of ['À réviser', 'Moyens mnémotechniques', 'Présentez-vous', 'Questions probables']) {
      expect(instructions).toContain(`## ${section}`);
      expect(fixedPrompt).not.toContain(`## ${section}`);
    }
    expect(fixedPrompt).toContain('titre de niveau 1');
    expect(fixedPrompt).toContain("N'invente jamais un fait sur le Candidat");
    expect(fixedPrompt).toContain('`[à compléter : …]`');
    expect(instructions).toBe(INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS);
    expect(version?.instructions).toBe(INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS);
  });

  it("replaces the default Instructions with the Candidate's own, keeping the fixed part", async () => {
    const instructions = 'Dix questions au plus, sans moyens mnémotechniques en images.\n';
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun());
    const { actions, dataDirectory } = await detectPostings(aiSession);
    mkdirSync(path.join(dataDirectory, 'candidates/lea/instructions'));
    writeFileSync(path.join(dataDirectory, 'candidates/lea/instructions/interview_brief.md'), instructions);
    await runModule(actions, 'research');

    const { version } = await runModule(actions, 'brief');

    expect(aiSession.headlessSessionList[1]?.instructions).toBe(instructions);
    expect(aiSession.headlessSessionList[1]?.fixedPrompt).toContain("N'invente jamais un fait sur le Candidat");
    expect(version?.instructions).toBe(instructions);
  });

  it('accepts a Fiche organised otherwise, as Instructions of the Candidate may ask', async () => {
    const tenQuestions = '# Fiche d’entretien\n\n## Dix questions\n\n- Pourquoi ce poste ?\n';
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, briefRun(tenQuestions)));
    await runModule(actions, 'research');

    const { state, version } = await runModule(actions, 'brief');

    expect(state).toBe('done');
    expect(version?.state).toBe('ready');
  });

  it('fails the Version of a Fiche without a title', async () => {
    const withoutTitle = INTERVIEW_BRIEF.replace(/^# .*\n/, '');
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, briefRun(withoutTitle)));
    await runModule(actions, 'research');

    const { state, version, log } = await runModule(actions, 'brief');

    expect(state).toBe('failed');
    expect(version?.state).toBe('failed');
    expect(log).toContain(
      'Le fichier interview_brief/v1/interview-brief.md est mal formé : il ne commence pas par un titre de niveau 1 (« # »).',
    );
  });
});

// A correction modifies the Chosen Version in place (spec « Versions »)
describe('correcting the Interview Brief', () => {
  it('saves the correction made in the front editor in the Chosen Version', async () => {
    const { actions, postingDirectory } = await detectPostings(createFakeAiSession(RESEARCH_RUN, briefRun()));
    await runModule(actions, 'research');
    await runModule(actions, 'brief');
    const corrected = INTERVIEW_BRIEF.replace(
      "[à compléter : diplôme et année d'obtention]",
      'master 2 de droit privé',
    );

    await actions.saveDocument({
      reference: REFERENCE,
      artifact: 'interview_brief',
      fileName: 'interview-brief.md',
      markdown: corrected,
    });

    const { artifactList } = await actions.readPosting({ reference: REFERENCE });
    const brief = artifactList.find(({ artifact }) => artifact === 'interview_brief');
    expect(brief?.versionList.map(({ documentList }) => documentList)).toEqual([
      [{ fileName: 'interview-brief.md', markdown: corrected, isModifiable: true }],
    ]);
    expect(readFileSync(path.join(postingDirectory, 'interview_brief/v1/interview-brief.md'), 'utf8')).toBe(corrected);
  });

  it('opens jf edit on the Chosen Version', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun(), briefRun());
    const { actions, postingDirectory } = await detectPostings(aiSession);
    await runModule(actions, 'research');
    await runModule(actions, 'brief');
    await runModule(actions, 'brief');
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'interview_brief', number: 1 });

    await actions.openArtifact({ reference: REFERENCE, artifact: 'interview_brief' });

    const [session] = aiSession.interactiveSessionList;
    expect(session?.directory).toBe(postingDirectory);
    expect(session?.prompt).toContain("Tu aides Léa à modifier la Fiche d’entretien de l'Offre 2026-2445600");
    expect(session?.prompt).toContain('`interview_brief/v1/`');
    expect(session?.prompt).not.toContain('interview_brief/v2');
  });
});
