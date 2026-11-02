import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { promptOf } from '#/artifact/prompt.ts';
import { DEFAULT_INSTRUCTIONS_FR } from '#/domain/catalogue/fr/default-instructions.ts';

import { applyTo } from './apply.ts';
import { detectPostings as detectRecordedPostings, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { markedValuesOf } from './marked-values.ts';
import { readVersionsOf } from './read-versions.ts';

// Léa's, in French
const INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS = DEFAULT_INSTRUCTIONS_FR.interview_brief;

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const POSTING_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

// Her first round with the court's HR, then the job-specific interview with a judge
const HR_INTERVIEW = {
  start: '2026-11-19T14:00',
  durationMinutes: 45,
  place: 'Tribunal judiciaire, Béthune',
  interviewers: 'Mme Durand, responsable RH de la cour d’appel',
};
const JUDGE_INTERVIEW = {
  start: '2026-12-03T10:00',
  place: 'Visioconférence',
  interviewers: 'M. Lefebvre, juge des enfants',
};

// Another Béthune Posting of Léa, whose Letter she sent
const SENT_REFERENCE = '2026-2445609';

const CV = '# Léa Martin\n\nMaster 2 de droit privé, Université de Lille, 2025.\n';

const NOTES = '# Appel du greffe\n\nLe premier tour porte sur la motivation.\n';

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

// Léa's Postings, her Béthune Posting Applied with a Chosen Research, and its first Interview
async function applyWithInterview(aiSession: ReturnType<typeof createFakeAiSession>) {
  const { actions, dataDirectory } = await detectRecordedPostings(aiSession);
  await runModule(actions, 'research');
  await applyTo(actions, REFERENCE);
  await actions.addInterview({ reference: REFERENCE, ...HR_INTERVIEW });
  return {
    actions,
    dataDirectory,
    postingDirectory: path.join(dataDirectory, LEA_POSTINGS_PATH, POSTING_DIRECTORY_NAME),
  };
}

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runModule(actions: Actions, module: string, interview?: number, reference = REFERENCE) {
  const { id } = await actions.runModule({ module, reference, interview });
  await actions.runQueuedJobs();
  return actions.followJob({ jobId: id });
}

describe('interview brief', () => {
  it('produces a new Version at each launch on an Interview, in its folder, the latest one chosen', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun(), briefRun());
    const { actions, postingDirectory } = await applyWithInterview(aiSession);

    const job = await runModule(actions, 'brief', 1);
    await runModule(actions, 'brief', 1);

    expect(job).toMatchObject({ module: 'interview_brief', state: 'done', interview: { number: 1 } });
    expect(job.version).toMatchObject({
      artifact: 'interview_brief',
      number: 1,
      state: 'ready',
      interview: { number: 1 },
    });
    expect(
      readFileSync(path.join(postingDirectory, 'interviews/1/interview_brief/v1/interview-brief.md'), 'utf8'),
    ).toBe(INTERVIEW_BRIEF);
    const versionList = await actions.listVersions({ reference: REFERENCE, artifact: 'interview_brief', interview: 1 });
    expect(versionList.map(({ number, isChosen }) => ({ number, isChosen }))).toEqual([
      { number: 1, isChosen: false },
      { number: 2, isChosen: true },
    ]);
  });

  // A first HR round and a job-specific interview are not prepared the same way (spec #45, story 39)
  it('numbers and chooses its Versions per Interview', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun(), briefRun(), briefRun());
    const { actions } = await applyWithInterview(aiSession);
    await actions.addInterview({ reference: REFERENCE, ...JUDGE_INTERVIEW });
    await runModule(actions, 'brief', 1);
    await runModule(actions, 'brief', 1);
    const judgeJob = await runModule(actions, 'brief', 2);

    await actions.chooseVersion({ reference: REFERENCE, artifact: 'interview_brief', interview: 1, number: 1 });

    expect(judgeJob.version).toMatchObject({ number: 1, interview: { number: 2 } });
    const { interviewList } = await actions.readPosting({ reference: REFERENCE });
    expect(
      interviewList.map(({ number, artifactList }) => ({
        number,
        chosenList: artifactList.map(({ artifact, versionList }) => ({
          artifact,
          chosen: versionList.filter(({ version }) => version.isChosen).map(({ version }) => version.number),
        })),
      })),
    ).toEqual([
      {
        number: 1,
        chosenList: [
          { artifact: 'portrait', chosen: [] },
          { artifact: 'interview_brief', chosen: [1] },
        ],
      },
      {
        number: 2,
        chosenList: [
          { artifact: 'portrait', chosen: [] },
          { artifact: 'interview_brief', chosen: [1] },
        ],
      },
    ]);
  });

  it('shows with the Portrait, apart from the Artifacts of the Posting, the Research and the Letter', async () => {
    const { actions } = await applyWithInterview(createFakeAiSession(RESEARCH_RUN));

    const { artifactList, interviewList } = await actions.readPosting({ reference: REFERENCE });

    expect(artifactList.map(({ artifact }) => artifact)).toEqual(['research', 'letter']);
    expect(
      interviewList.map(({ artifactList: interviewArtifactList }) =>
        interviewArtifactList.map(({ artifact }) => artifact),
      ),
    ).toEqual([['portrait', 'interview_brief']]);
  });

  // The interview comes once the Letter is sent: the Interview Brief prepares the questions on it
  it('receives inlined the Job Description, the Chosen Research, the Chosen Letter, the one sent, and the Profile', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, LETTER_RUN, RESEARCH_RUN, RESEARCH_RUN, LETTER_RUN, briefRun());
    const { actions, dataDirectory } = await detectRecordedPostings(aiSession);
    const postingDirectory = path.join(dataDirectory, LEA_POSTINGS_PATH, POSTING_DIRECTORY_NAME);
    writeFileSync(path.join(dataDirectory, 'candidates/lea/profile/cv.md'), CV);
    await runModule(actions, 'research', undefined, SENT_REFERENCE);
    await runModule(actions, 'letter', undefined, SENT_REFERENCE);
    await applyTo(actions, SENT_REFERENCE);
    await runModule(actions, 'research');
    await runModule(actions, 'research');
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'research', number: 1 });
    await runModule(actions, 'letter');
    await applyTo(actions, REFERENCE);
    await actions.addInterview({ reference: REFERENCE, ...HR_INTERVIEW });

    const { version } = await runModule(actions, 'brief', 1);

    const session = aiSession.headlessSessionList.at(-1);
    const jobDescription = readFileSync(path.join(postingDirectory, 'job-description.md'), 'utf8');
    // Its own Letter is the Chosen Letter, never also a Past Letter; a sent Letter comes without its Original
    expect(session?.message).toBe(
      [
        '# Inputs',
        `## Input: Job Description\n\n${jobDescription.trim()}`,
        `## Input: Chosen Research\n\n${RESEARCH_RUN.fileByName['research.md'].trim()}`,
        `## Input: Chosen Letter\n\n${LETTER_RUN.fileByName['draft.md'].trim()}`,
        `## Input: Profile: cv.md\n\n${CV.trim()}`,
        `## Input: Letter sent for Posting ${SENT_REFERENCE}\n\n${LETTER_RUN.fileByName['draft.md'].trim()}`,
        '# Instructions',
        INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS.trim(),
      ].join('\n\n'),
    );
    // The session reads no Input from disk (ADR-0021)
    expect(session?.fixedPrompt).not.toMatch(/job-description\.md|research\.md|letter\.md|profile|uploads/);
    expect(session).toMatchObject({ isReadingDirectory: false, isSearchingWeb: false });
    expect(session?.fixedPrompt).toContain('The Inputs hold the Chosen Letter');
    expect(readVersionsOf(version)).toEqual([
      { artifact: 'research', number: 1, posting: { reference: REFERENCE }, interview: null },
      { artifact: 'letter', number: 1, posting: { reference: REFERENCE }, interview: null },
      { artifact: 'letter', number: 1, posting: { reference: SENT_REFERENCE }, interview: null },
    ]);
  });

  it('runs without a Letter, and tells the session there is none', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun());
    const { actions } = await applyWithInterview(aiSession);

    const { state, version } = await runModule(actions, 'brief', 1);

    expect(state).toBe('done');
    const session = aiSession.headlessSessionList.at(-1);
    expect(session?.fixedPrompt).toContain('The Candidate has no Letter for this Posting');
    expect(session?.message).not.toContain('Letter');
    expect(readVersionsOf(version)).toEqual([
      { artifact: 'research', number: 1, posting: { reference: REFERENCE }, interview: null },
    ]);
  });
});

describe('the prompt of the Interview Brief', () => {
  it('holds the Interview, and receives by default the Notes and the Chosen Interview Brief of the previous round', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun(), briefRun('# Seconde\n'), briefRun());
    const { actions } = await applyWithInterview(aiSession);
    await actions.addInterview({ reference: REFERENCE, ...JUDGE_INTERVIEW });
    await actions.saveNotes({ reference: REFERENCE, notes: NOTES });
    await runModule(actions, 'brief', 1);
    await runModule(actions, 'brief', 1);
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'interview_brief', interview: 1, number: 1 });

    const { version } = await runModule(actions, 'brief', 2);

    const { fixedPrompt, message } = aiSession.headlessSessionList.at(-1) ?? {};
    expect(fixedPrompt).toContain('Interview 2 of this Posting');
    expect(fixedPrompt).toContain('2026-12-03 10:00, Paris time; duration: 60 minutes');
    expect(fixedPrompt).toContain('Visioconférence');
    expect(fixedPrompt).toContain('M. Lefebvre, juge des enfants');
    expect(fixedPrompt).toContain('The Chosen Interview Brief of the previous Interview 1');
    expect(fixedPrompt).not.toContain('Le premier tour porte sur la motivation.');
    expect(message).toContain(
      `## Input: Chosen Interview Brief of Interview 1\n\n${INTERVIEW_BRIEF.trim()}\n\n## Input: The Candidate's Notes\n\n${NOTES.trim()}\n\n`,
    );
    expect(message).not.toContain('# Seconde');
    expect(version?.inputList.map(({ key }) => key)).toEqual([
      'job_description',
      'artifact:research',
      'artifact:interview_brief@1',
      'notes',
    ]);
  });

  it('is the one its preview composes, with the Posting and the Interview marked where they are substituted', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun(), briefRun());
    const { actions } = await applyWithInterview(aiSession);
    await actions.addInterview({ reference: REFERENCE, ...JUDGE_INTERVIEW });
    await actions.saveNotes({ reference: REFERENCE, notes: NOTES });
    await runModule(actions, 'brief', 1);
    const { interviewList } = await actions.readPosting({ reference: REFERENCE });
    const prompt = interviewList[1]?.artifactList.find(({ artifact }) => artifact === 'interview_brief')?.module.prompt;

    await runModule(actions, 'brief', 2);

    const session = aiSession.headlessSessionList.at(-1);
    expect(prompt?.prompt.replaceAll('interview_brief/v<next>', 'interview_brief/v1')).toBe(
      session && promptOf(session),
    );
    expect(markedValuesOf(prompt?.markedFixedPart)).toEqual([
      REFERENCE,
      'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE',
      "Cour d'Appel de Douai",
      'Tribunal Judiciaire de Béthune',
      '2',
      '2026-12-03 10:00',
      '60',
      'Visioconférence',
      'M. Lefebvre, juge des enfants',
      '1',
      'interviews/2/interview_brief/v<next>/interview-brief.md',
      'interviews/2/interview_brief/v<next>/interview-brief.md',
    ]);
  });

  it('reads no Interview Brief for the first round, nor the later ones', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun(), briefRun());
    const { actions } = await applyWithInterview(aiSession);
    await actions.addInterview({ reference: REFERENCE, ...JUDGE_INTERVIEW });
    await runModule(actions, 'brief', 2);

    await runModule(actions, 'brief', 1);

    const fixedPrompt = aiSession.headlessSessionList.at(-1)?.fixedPrompt;
    expect(fixedPrompt).toContain('2026-11-19 14:00, Paris time; duration: 45 minutes');
    expect(fixedPrompt).toContain('This is the first Interview of the Posting');
    expect(aiSession.headlessSessionList.at(-1)?.message).not.toContain('Interview Brief');
  });

  it('asks for an Interview Brief organized to revise and train, without inventing a fact on the Candidate', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun());
    const { actions } = await applyWithInterview(aiSession);

    const { version } = await runModule(actions, 'brief', 1);

    const { fixedPrompt, message: instructions = '' } = aiSession.headlessSessionList[1] ?? {};
    // The plan is the default Instructions': the Candidate's own may organize the Interview Brief otherwise
    for (const section of ['À réviser', 'Moyens mnémotechniques', 'Présentez-vous', 'Questions probables']) {
      expect(instructions).toContain(`## ${section}`);
      expect(fixedPrompt).not.toContain(`## ${section}`);
    }
    expect(instructions).toContain('Adapte le discours aux Interlocuteurs');
    expect(fixedPrompt).toContain('level 1 heading');
    expect(fixedPrompt).toContain('Never invent a fact about the Candidate');
    expect(fixedPrompt).toContain('`[à compléter : …]`');
    expect(instructions.endsWith(`# Instructions\n\n${INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS.trim()}`)).toBe(true);
    expect(version?.instructions).toBe(INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS);
  });

  it("replaces the default Instructions with the Candidate's own, keeping the fixed part", async () => {
    const instructions = 'Dix questions au plus, sans moyens mnémotechniques en images.\n';
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun());
    const { actions, dataDirectory } = await applyWithInterview(aiSession);
    mkdirSync(path.join(dataDirectory, 'candidates/lea/instructions'));
    writeFileSync(path.join(dataDirectory, 'candidates/lea/instructions/interview_brief.md'), instructions);

    const { version } = await runModule(actions, 'brief', 1);

    expect(aiSession.headlessSessionList[1]?.message).toMatch(
      /# Instructions\n\nDix questions au plus, sans moyens mnémotechniques en images\.$/,
    );
    expect(aiSession.headlessSessionList[1]?.fixedPrompt).toContain('Never invent a fact about the Candidate');
    expect(version?.instructions).toBe(instructions);
  });

  it('accepts an Interview Brief organized otherwise, as Instructions of the Candidate may ask', async () => {
    const tenQuestions = '# Fiche d’entretien\n\n## Dix questions\n\n- Pourquoi ce poste ?\n';
    const { actions } = await applyWithInterview(createFakeAiSession(RESEARCH_RUN, briefRun(tenQuestions)));

    const { state, version } = await runModule(actions, 'brief', 1);

    expect(state).toBe('done');
    expect(version?.state).toBe('ready');
  });

  it('fails the Version of an Interview Brief without a title', async () => {
    const withoutTitle = INTERVIEW_BRIEF.replace(/^# .*\n/, '');
    const { actions } = await applyWithInterview(createFakeAiSession(RESEARCH_RUN, briefRun(withoutTitle)));

    const { state, version, log } = await runModule(actions, 'brief', 1);

    expect(state).toBe('failed');
    expect(version?.state).toBe('failed');
    expect(log).toContain(
      'Le fichier interviews/1/interview_brief/v1/interview-brief.md est mal formé : il ne commence pas par un titre de niveau 1 (« # »).',
    );
  });
});

// A correction modifies the Chosen Version in place (spec « Versions »)
describe('correcting the Interview Brief', () => {
  it('saves the correction made in the front editor in the Chosen Version of its Interview', async () => {
    const { actions, postingDirectory } = await applyWithInterview(createFakeAiSession(RESEARCH_RUN, briefRun()));
    await runModule(actions, 'brief', 1);
    const corrected = INTERVIEW_BRIEF.replace(
      "[à compléter : diplôme et année d'obtention]",
      'master 2 de droit privé',
    );

    await actions.saveDocument({
      reference: REFERENCE,
      artifact: 'interview_brief',
      interview: '1',
      fileName: 'interview-brief.md',
      markdown: corrected,
    });

    const { interviewList } = await actions.readPosting({ reference: REFERENCE });
    const brief = interviewList[0]?.artifactList.find(({ artifact }) => artifact === 'interview_brief');
    expect(brief?.versionList.map(({ documentList }) => documentList)).toEqual([
      [{ fileName: 'interview-brief.md', markdown: corrected, isModifiable: true }],
    ]);
    expect(
      readFileSync(path.join(postingDirectory, 'interviews/1/interview_brief/v1/interview-brief.md'), 'utf8'),
    ).toBe(corrected);
  });

  it('opens jf edit on the Chosen Version of its Interview', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun(), briefRun());
    const { actions, postingDirectory } = await applyWithInterview(aiSession);
    await runModule(actions, 'brief', 1);
    await runModule(actions, 'brief', 1);
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'interview_brief', interview: 1, number: 1 });

    await actions.openArtifact({ reference: REFERENCE, artifact: 'interview_brief', interview: 1 });

    const [session] = aiSession.interactiveSessionList;
    expect(session?.directory).toBe(postingDirectory);
    expect(session?.prompt).toContain('You help Léa modify the Interview Brief of Posting 2026-2445600');
    expect(session?.prompt).toContain('`interviews/1/interview_brief/v1/`');
    expect(session?.prompt).not.toContain('interview_brief/v2');
  });

  it('is offered by jf edit with its Interview', async () => {
    const { actions } = await applyWithInterview(createFakeAiSession(RESEARCH_RUN, briefRun()));
    await runModule(actions, 'brief', 1);

    const versionList = await actions.listChosenVersions({ reference: REFERENCE });

    expect(versionList.map(({ artifact, interview }) => ({ artifact, interview }))).toEqual([
      { artifact: 'research', interview: null },
      { artifact: 'interview_brief', interview: { number: 1 } },
    ]);
  });
});

// Story 24: an Interview entered by mistake goes with all it prepared
describe('deleting an Interview', () => {
  it('deletes its Versions, their jobs and their files, and leaves the other Interviews and the Posting', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, briefRun(), briefRun());
    const { actions, postingDirectory } = await applyWithInterview(aiSession);
    await actions.addInterview({ reference: REFERENCE, ...JUDGE_INTERVIEW });
    await runModule(actions, 'brief', 1);
    await runModule(actions, 'brief', 2);

    await actions.deleteInterview({ reference: REFERENCE, number: 1 });

    expect(existsSync(path.join(postingDirectory, 'interviews/1'))).toBe(false);
    expect(existsSync(path.join(postingDirectory, 'interviews/2/interview_brief/v1/interview-brief.md'))).toBe(true);
    expect(existsSync(path.join(postingDirectory, 'research/v1/research.md'))).toBe(true);
    const { interviewList, artifactList } = await actions.readPosting({ reference: REFERENCE });
    expect(interviewList.map(({ number }) => number)).toEqual([2]);
    expect(artifactList.find(({ artifact }) => artifact === 'research')?.state).toBe('ready');
    await expect(actions.followJob({ jobId: 2 })).rejects.toMatchObject({ code: 'unknown_job' });
    expect(await actions.followJob({ jobId: 3 })).toMatchObject({ state: 'done', interview: { number: 2 } });
  });

  it('gives its number back, with no Version, to the next Interview added', async () => {
    const { actions } = await applyWithInterview(createFakeAiSession(RESEARCH_RUN, briefRun()));
    await runModule(actions, 'brief', 1);

    await actions.deleteInterview({ reference: REFERENCE, number: 1 });
    await actions.addInterview({ reference: REFERENCE, ...JUDGE_INTERVIEW });

    expect(await actions.listVersions({ reference: REFERENCE, artifact: 'interview_brief', interview: 1 })).toEqual([]);
  });
});
