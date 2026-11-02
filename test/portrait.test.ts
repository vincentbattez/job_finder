import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { promptOf } from '#/artifact/prompt.ts';
import { DEFAULT_INSTRUCTIONS_FR } from '#/domain/catalogue/fr/default-instructions.ts';

import { detectPostings as detectRecordedPostings, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { markedValuesOf } from './marked-values.ts';
import { readVersionsOf } from './read-versions.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const POSTING_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

// Her job-specific interview with a judge of the court
const JUDGE_INTERVIEW = {
  start: '2026-12-03T10:00',
  durationMinutes: 45,
  place: 'Tribunal judiciaire, Béthune',
  interviewers: 'M. Lefebvre, juge des enfants',
};

const RESEARCH_RUN = {
  fileByName: {
    'research.md':
      '# Recherche\n\nLe TJ de Béthune ([justice.fr](https://www.justice.fr/)).\n\n## Sources\n\n- https://www.justice.fr/\n',
  },
};

const PORTRAIT = `# Portrait : M. Lefebvre

Juge des enfants à Béthune depuis 2021 ([cour d'appel de Douai](https://www.cours-appel.justice.fr/douai)).

Un homonyme, avocat à Lille : à écarter.
`;

function portraitRun(markdown = PORTRAIT) {
  return { fileByName: { 'portrait.md': markdown } };
}

const BRIEF_RUN = { fileByName: { 'interview-brief.md': "# Fiche d'entretien\n\n## À réviser\n\n- Le CJPM.\n" } };

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runModule(actions: Actions, module: string, interview?: number) {
  const { id } = await actions.runModule({ module, reference: REFERENCE, interview });
  await actions.runQueuedJobs();
  return actions.followJob({ jobId: id });
}

// Léa's Postings, her Béthune Posting Applied, with its Interview with the judge
async function applyWithInterview(aiSession: ReturnType<typeof createFakeAiSession>) {
  const { actions, dataDirectory } = await detectRecordedPostings(aiSession);
  await actions.changeStatus({ reference: REFERENCE, status: 'applied' });
  await actions.addInterview({ reference: REFERENCE, ...JUDGE_INTERVIEW });
  return {
    actions,
    dataDirectory,
    postingDirectory: path.join(dataDirectory, LEA_POSTINGS_PATH, POSTING_DIRECTORY_NAME),
  };
}

describe('portrait', () => {
  it('produces a Version attached to the Interview, in its folder, before its Interview Brief', async () => {
    const { actions, postingDirectory } = await applyWithInterview(createFakeAiSession(portraitRun()));

    const job = await runModule(actions, 'portrait', 1);

    expect(job).toMatchObject({ module: 'portrait', state: 'done', interview: { number: 1 } });
    expect(job.version).toMatchObject({ artifact: 'portrait', number: 1, state: 'ready', interview: { number: 1 } });
    expect(readFileSync(path.join(postingDirectory, 'interviews/1/portrait/v1/portrait.md'), 'utf8')).toBe(PORTRAIT);
    const { artifactList, interviewList } = await actions.readPosting({ reference: REFERENCE });
    expect(artifactList.map(({ artifact }) => artifact)).toEqual(['research', 'letter']);
    expect(interviewList[0]?.artifactList.map(({ artifact }) => artifact)).toEqual(['portrait', 'interview_brief']);
  });

  it('is edited, rerun and chosen like the other Artifacts', async () => {
    const corrected = PORTRAIT.replace('Un homonyme, avocat à Lille : à écarter.\n', '');
    const { actions } = await applyWithInterview(createFakeAiSession(portraitRun(), portraitRun()));
    await runModule(actions, 'portrait', 1);
    await runModule(actions, 'portrait', 1);

    await actions.chooseVersion({ reference: REFERENCE, artifact: 'portrait', interview: 1, number: 1 });
    await actions.saveDocument({
      reference: REFERENCE,
      artifact: 'portrait',
      interview: '1',
      fileName: 'portrait.md',
      markdown: corrected,
    });

    const versionList = await actions.listVersions({ reference: REFERENCE, artifact: 'portrait', interview: 1 });
    expect(versionList.map(({ number, isChosen }) => ({ number, isChosen }))).toEqual([
      { number: 1, isChosen: true },
      { number: 2, isChosen: false },
    ]);
    const { interviewList } = await actions.readPosting({ reference: REFERENCE });
    const portrait = interviewList[0]?.artifactList.find(({ artifact }) => artifact === 'portrait');
    expect(portrait?.versionList[0]?.documentList).toEqual([
      { fileName: 'portrait.md', markdown: corrected, isModifiable: true },
    ]);
  });

  it('fails the Version of a Portrait without a title', async () => {
    const withoutTitle = PORTRAIT.replace(/^# .*\n/, '');
    const { actions } = await applyWithInterview(createFakeAiSession(portraitRun(withoutTitle)));

    const { state, log } = await runModule(actions, 'portrait', 1);

    expect(state).toBe('failed');
    expect(log).toContain(
      'Le fichier interviews/1/portrait/v1/portrait.md est mal formé : il ne commence pas par un titre de niveau 1 (« # »).',
    );
  });
});

describe('the prompt of the Portrait', () => {
  it('holds the Interview and the Posting, and gives the Chosen Research inlined when there is one', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, portraitRun());
    const { actions } = await applyWithInterview(aiSession);
    await runModule(actions, 'research');

    const { version } = await runModule(actions, 'portrait', 1);

    const session = aiSession.headlessSessionList.at(-1);
    expect(session?.fixedPrompt).toContain('Interview 1 of this Posting');
    expect(session?.fixedPrompt).toContain('2026-12-03 10:00, Paris time');
    expect(session?.fixedPrompt).toContain('Tribunal judiciaire, Béthune');
    expect(session?.fixedPrompt).toContain('M. Lefebvre, juge des enfants');
    expect(session?.fixedPrompt).toContain(REFERENCE);
    expect(session?.message).toContain('## Input: Job Description\n\n');
    expect(session?.message).toContain(
      `## Input: Chosen Research\n\n${RESEARCH_RUN.fileByName['research.md'].trim()}\n\n# Instructions`,
    );
    // The session reads no Input from disk (ADR-0021), and nothing about the Candidate portrays the Interviewers
    expect(session?.fixedPrompt).not.toMatch(/research\.md|job-description\.md/);
    expect(session?.readDirectoryList).toEqual([]);
    expect(readVersionsOf(version)).toEqual([
      { artifact: 'research', number: 1, posting: { reference: REFERENCE }, interview: null },
    ]);
  });

  it('runs without a Research, and tells the session there is none', async () => {
    const aiSession = createFakeAiSession(portraitRun());
    const { actions } = await applyWithInterview(aiSession);

    const { state, version } = await runModule(actions, 'portrait', 1);

    expect(state).toBe('done');
    expect(aiSession.headlessSessionList.at(-1)?.fixedPrompt).toContain('no Research');
    expect(readVersionsOf(version)).toEqual([]);
  });

  it('keeps to professional and public information, sourced, flagging any doubt on an identity', async () => {
    const aiSession = createFakeAiSession(portraitRun());
    const { actions } = await applyWithInterview(aiSession);

    const { version } = await runModule(actions, 'portrait', 1);

    const { fixedPrompt, message } = aiSession.headlessSessionList.at(-1) ?? {};
    expect(fixedPrompt).toContain('level 1 heading');
    expect(message).toMatch(/# Instructions\n\n[^]*vie privée[^]*sources[^]*homonyme/);
    expect(version?.instructions).toBe(DEFAULT_INSTRUCTIONS_FR.portrait);
  });

  it("replaces the default Instructions with the Candidate's own, keeping the fixed part", async () => {
    const instructions = 'Seulement leurs publications.\n';
    const aiSession = createFakeAiSession(portraitRun());
    const { actions, dataDirectory } = await applyWithInterview(aiSession);
    mkdirSync(path.join(dataDirectory, 'candidates/lea/instructions'));
    writeFileSync(path.join(dataDirectory, 'candidates/lea/instructions/portrait.md'), instructions);

    await runModule(actions, 'portrait', 1);

    const session = aiSession.headlessSessionList.at(-1);
    expect(session?.message).toMatch(/# Instructions\n\nSeulement leurs publications\.$/);
    expect(session?.fixedPrompt).toContain('Interview 1 of this Posting');
  });

  it('is the one its preview composes, with the Interview and the Posting marked where they are substituted', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, portraitRun());
    const { actions } = await applyWithInterview(aiSession);
    await runModule(actions, 'research');
    const { interviewList } = await actions.readPosting({ reference: REFERENCE });
    const prompt = interviewList[0]?.artifactList.find(({ artifact }) => artifact === 'portrait')?.module.prompt;

    await runModule(actions, 'portrait', 1);

    const session = aiSession.headlessSessionList.at(-1);
    expect(prompt?.prompt.replaceAll('portrait/v<next>', 'portrait/v1')).toBe(session && promptOf(session));
    expect(markedValuesOf(prompt?.markedFixedPart)).toEqual([
      REFERENCE,
      'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE',
      "Cour d'Appel de Douai",
      'Tribunal Judiciaire de Béthune',
      '1',
      '2026-12-03 10:00',
      'Tribunal judiciaire, Béthune',
      'M. Lefebvre, juge des enfants',
      'interviews/1/portrait/v<next>/portrait.md',
      'interviews/1/portrait/v<next>/portrait.md',
    ]);
  });
});

// The Interview Brief adapts the pitch to the Interviewers as the Portrait establishes them
describe('the Interview Brief and the Portrait', () => {
  it('reads the Chosen Portrait of its Interview', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, portraitRun(), portraitRun(), BRIEF_RUN);
    const { actions, postingDirectory } = await applyWithInterview(aiSession);
    await runModule(actions, 'research');
    await runModule(actions, 'portrait', 1);
    await runModule(actions, 'portrait', 1);
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'portrait', interview: 1, number: 1 });

    const { version } = await runModule(actions, 'brief', 1);

    const fixedPrompt = aiSession.headlessSessionList.at(-1)?.fixedPrompt;
    expect(fixedPrompt).toContain(
      `The Chosen Portrait of the Interviewers: \`${path.join(postingDirectory, 'interviews/1/portrait/v1/portrait.md')}\``,
    );
    expect(fixedPrompt).not.toContain('portrait/v2');
    expect(readVersionsOf(version)).toEqual([
      { artifact: 'research', number: 1, posting: { reference: REFERENCE }, interview: null },
      { artifact: 'portrait', number: 1, posting: { reference: REFERENCE }, interview: { number: 1 } },
    ]);
  });

  it('runs without a Portrait, and tells the session there is none', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, BRIEF_RUN);
    const { actions } = await applyWithInterview(aiSession);
    await runModule(actions, 'research');

    const { state, version } = await runModule(actions, 'brief', 1);

    expect(state).toBe('done');
    const fixedPrompt = aiSession.headlessSessionList.at(-1)?.fixedPrompt;
    expect(fixedPrompt).toContain('No Portrait of the Interviewers');
    expect(fixedPrompt).not.toContain('portrait.md');
    expect(readVersionsOf(version)).toEqual([
      { artifact: 'research', number: 1, posting: { reference: REFERENCE }, interview: null },
    ]);
  });

  it('does not read the Portrait of another Interview', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, portraitRun(), BRIEF_RUN);
    const { actions } = await applyWithInterview(aiSession);
    await actions.addInterview({ reference: REFERENCE, ...JUDGE_INTERVIEW, start: '2026-12-10T10:00' });
    await runModule(actions, 'research');
    await runModule(actions, 'portrait', 1);

    await runModule(actions, 'brief', 2);

    expect(aiSession.headlessSessionList.at(-1)?.fixedPrompt).toContain('No Portrait of the Interviewers');
  });
});
