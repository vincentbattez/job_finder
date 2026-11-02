import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { DEFAULT_INSTRUCTIONS_FR } from '#/domain/catalogue/fr/default-instructions.ts';

import { detectPostings as detectRecordedPostings, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// Léa's, in French
const RESEARCH_DEFAULT_INSTRUCTIONS = DEFAULT_INSTRUCTIONS_FR.research;

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const POSTING_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RESEARCH = `# Recherche : attaché de justice au tribunal pour enfants de Béthune

Le tribunal judiciaire de Béthune compte un tribunal pour enfants ([justice.fr](https://www.justice.fr/)).

## Sources

- [justice.fr](https://www.justice.fr/)
`;

async function detectPostings(aiSession: ReturnType<typeof createFakeAiSession>) {
  const { actions, dataDirectory } = await detectRecordedPostings(aiSession);
  return {
    actions,
    dataDirectory,
    postingDirectory: path.join(dataDirectory, LEA_POSTINGS_PATH, POSTING_DIRECTORY_NAME),
  };
}

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runResearch(actions: Actions) {
  const { id } = await actions.runModule({ module: 'research', reference: REFERENCE });
  await actions.runQueuedJobs();
  return actions.followJob({ jobId: id });
}

describe('research', () => {
  it('produces the Research of a Posting as its first Version, retained', async () => {
    const aiSession = createFakeAiSession({ fileByName: { 'research.md': RESEARCH } });
    const { actions, postingDirectory } = await detectPostings(aiSession);

    const job = await runResearch(actions);

    expect(job).toMatchObject({ module: 'research', state: 'done', sessionId: 'fake-session-1' });
    expect(job.version).toMatchObject({ artifact: 'research', number: 1, state: 'ready', isChosen: true });
    expect(readFileSync(path.join(postingDirectory, 'research/v1/research.md'), 'utf8')).toBe(RESEARCH);
  });

  it('creates a new Version at each launch without overwriting the previous ones, and retains the latest', async () => {
    const secondResearch = RESEARCH.replace('Recherche :', 'Recherche relancée :');
    const aiSession = createFakeAiSession(
      { fileByName: { 'research.md': RESEARCH } },
      { fileByName: { 'research.md': secondResearch } },
    );
    const { actions, postingDirectory } = await detectPostings(aiSession);

    await runResearch(actions);
    await runResearch(actions);

    const versionList = await actions.listVersions({ reference: REFERENCE, artifact: 'research' });
    expect(versionList.map(({ number, isChosen }) => ({ number, isChosen }))).toEqual([
      { number: 1, isChosen: false },
      { number: 2, isChosen: true },
    ]);
    expect(readFileSync(path.join(postingDirectory, 'research/v1/research.md'), 'utf8')).toBe(RESEARCH);
    expect(readFileSync(path.join(postingDirectory, 'research/v2/research.md'), 'utf8')).toBe(secondResearch);
  });

  it('retains the Version the Candidate chooses', async () => {
    const research = { fileByName: { 'research.md': RESEARCH } };
    const { actions } = await detectPostings(createFakeAiSession(research, research));
    await runResearch(actions);
    await runResearch(actions);

    await actions.chooseVersion({ reference: REFERENCE, artifact: 'research', number: '1' });

    const versionList = await actions.listVersions({ reference: REFERENCE, artifact: 'research' });
    expect(versionList.map(({ number, isChosen }) => ({ number, isChosen }))).toEqual([
      { number: 1, isChosen: true },
      { number: 2, isChosen: false },
    ]);
  });

  it('sends the fixed part of the prompt and the default Instructions, and keeps them in the Version', async () => {
    const aiSession = createFakeAiSession({ fileByName: { 'research.md': RESEARCH } });
    const { actions, postingDirectory } = await detectPostings(aiSession);

    const { version } = await runResearch(actions);

    expect(aiSession.headlessSessionList).toHaveLength(1);
    expect(aiSession.headlessSessionList[0]).toMatchObject({
      instructions: RESEARCH_DEFAULT_INSTRUCTIONS,
      directory: postingDirectory,
      outputDirectory: path.join(postingDirectory, 'research/v1'),
    });
    expect(aiSession.headlessSessionList[0]?.fixedPrompt).toContain('Never invent a fact.');
    expect(aiSession.headlessSessionList[0]?.fixedPrompt).toContain('`research/v1/research.md`');
    expect(version).toMatchObject({ instructions: RESEARCH_DEFAULT_INSTRUCTIONS, inputList: [] });
  });

  it("replaces the default Instructions with the Candidate's own, keeping the fixed part", async () => {
    const instructions = 'Insiste sur la justice des mineurs dans le ressort de Béthune.\n';
    const aiSession = createFakeAiSession({ fileByName: { 'research.md': RESEARCH } });
    const { actions, dataDirectory } = await detectPostings(aiSession);
    mkdirSync(path.join(dataDirectory, 'candidates/lea/instructions'));
    writeFileSync(path.join(dataDirectory, 'candidates/lea/instructions/research.md'), instructions);

    const { version } = await runResearch(actions);

    expect(aiSession.headlessSessionList[0]?.instructions).toBe(instructions);
    expect(aiSession.headlessSessionList[0]?.fixedPrompt).toContain('Never invent a fact.');
    expect(version?.instructions).toBe(instructions);
  });
});

describe('a launch refused', () => {
  it('refuses a module that does not exist, without launching Claude', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await detectPostings(aiSession);

    await expect(actions.runModule({ module: 'inconnu', reference: REFERENCE })).rejects.toThrow(
      'Module inconnu : inconnu. Modules : research, letter, portrait, brief.',
    );
    expect(aiSession.headlessSessionList).toEqual([]);
  });
});

describe('a Research that fails', () => {
  it.each([
    { problem: 'the expected file is absent', plannedRun: {}, log: /research\/v1\/research\.md est absent/ },
    {
      problem: 'the expected file is empty',
      plannedRun: { fileByName: { 'research.md': ' \n' } },
      log: /research\/v1\/research\.md est vide/,
    },
    {
      problem: 'the expected file has no sources',
      plannedRun: { fileByName: { 'research.md': '# Recherche\n\nAucune source.\n' } },
      log: /research\/v1\/research\.md est mal formé/,
    },
    {
      problem: 'the Claude session fails',
      plannedRun: { fileByName: { 'research.md': RESEARCH }, isSuccess: false },
      log: /Claude Code a rencontré une erreur/,
    },
  ])('puts the Version and the job « en échec » when $problem', async ({ plannedRun, log }) => {
    const { actions } = await detectPostings(createFakeAiSession(plannedRun));

    const job = await runResearch(actions);

    expect(job.state).toBe('failed');
    expect(job.log).toMatch(log);
    expect(job.version).toMatchObject({ number: 1, state: 'failed', isChosen: false });
  });

  it('keeps the Chosen Version when a new launch fails, and can be launched again', async () => {
    const research = { fileByName: { 'research.md': RESEARCH } };
    const { actions } = await detectPostings(createFakeAiSession(research, {}, research));

    await runResearch(actions);
    await runResearch(actions);
    const afterFailureVersionList = await actions.listVersions({ reference: REFERENCE, artifact: 'research' });
    await runResearch(actions);

    expect(afterFailureVersionList.map(({ number, state, isChosen }) => ({ number, state, isChosen }))).toEqual([
      { number: 1, state: 'ready', isChosen: true },
      { number: 2, state: 'failed', isChosen: false },
    ]);
    const versionList = await actions.listVersions({ reference: REFERENCE, artifact: 'research' });
    expect(versionList.map(({ number, state, isChosen }) => ({ number, state, isChosen }))).toEqual([
      { number: 1, state: 'ready', isChosen: false },
      { number: 2, state: 'failed', isChosen: false },
      { number: 3, state: 'ready', isChosen: true },
    ]);
  });

  it('refuses to retain a failed Version', async () => {
    const { actions } = await detectPostings(createFakeAiSession({}));
    await runResearch(actions);

    await expect(actions.chooseVersion({ reference: REFERENCE, artifact: 'research', number: 1 })).rejects.toThrow(
      /research v1 de l'Offre 2026-2445600 est en échec/,
    );
  });
});
