import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { RECHERCHE_DEFAULT_INSTRUCTIONS } from '#/modules/recherche/instructions.ts';

import { detectPostings as detectRecordedPostings, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune Posting of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const POSTING_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RECHERCHE = `# Recherche : attaché de justice au tribunal pour enfants de Béthune

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
async function runRecherche(actions: Actions) {
  const { id } = await actions.runModule({ module: 'recherche', reference: REFERENCE });
  await actions.runQueuedJobs();
  return actions.followJob({ jobId: id });
}

describe('recherche', () => {
  it('produces the Recherche of a Posting as its first Version, retained', async () => {
    const aiSession = createFakeAiSession({ fileByName: { 'recherche.md': RECHERCHE } });
    const { actions, postingDirectory } = await detectPostings(aiSession);

    const job = await runRecherche(actions);

    expect(job).toMatchObject({ module: 'recherche', state: 'done', sessionId: 'fake-session-1' });
    expect(job.version).toMatchObject({ artefact: 'recherche', number: 1, state: 'ready', isRetenue: true });
    expect(readFileSync(path.join(postingDirectory, 'recherche/v1/recherche.md'), 'utf8')).toBe(RECHERCHE);
  });

  it('creates a new Version at each launch without overwriting the previous ones, and retains the latest', async () => {
    const secondRecherche = RECHERCHE.replace('Recherche :', 'Recherche relancée :');
    const aiSession = createFakeAiSession(
      { fileByName: { 'recherche.md': RECHERCHE } },
      { fileByName: { 'recherche.md': secondRecherche } },
    );
    const { actions, postingDirectory } = await detectPostings(aiSession);

    await runRecherche(actions);
    await runRecherche(actions);

    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    expect(versionList.map(({ number, isRetenue }) => ({ number, isRetenue }))).toEqual([
      { number: 1, isRetenue: false },
      { number: 2, isRetenue: true },
    ]);
    expect(readFileSync(path.join(postingDirectory, 'recherche/v1/recherche.md'), 'utf8')).toBe(RECHERCHE);
    expect(readFileSync(path.join(postingDirectory, 'recherche/v2/recherche.md'), 'utf8')).toBe(secondRecherche);
  });

  it('retains the Version the Candidate chooses', async () => {
    const recherche = { fileByName: { 'recherche.md': RECHERCHE } };
    const { actions } = await detectPostings(createFakeAiSession(recherche, recherche));
    await runRecherche(actions);
    await runRecherche(actions);

    await actions.retenirVersion({ reference: REFERENCE, artefact: 'recherche', number: '1' });

    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    expect(versionList.map(({ number, isRetenue }) => ({ number, isRetenue }))).toEqual([
      { number: 1, isRetenue: true },
      { number: 2, isRetenue: false },
    ]);
  });

  it('sends the fixed part of the prompt and the default Instructions, and keeps them in the Version', async () => {
    const aiSession = createFakeAiSession({ fileByName: { 'recherche.md': RECHERCHE } });
    const { actions, postingDirectory } = await detectPostings(aiSession);

    const { version } = await runRecherche(actions);

    expect(aiSession.headlessSessionList).toHaveLength(1);
    expect(aiSession.headlessSessionList[0]).toMatchObject({
      instructions: RECHERCHE_DEFAULT_INSTRUCTIONS,
      directory: postingDirectory,
      outputDirectory: path.join(postingDirectory, 'recherche/v1'),
    });
    expect(aiSession.headlessSessionList[0]?.fixedPrompt).toContain("N'invente jamais un fait.");
    expect(aiSession.headlessSessionList[0]?.fixedPrompt).toContain('`recherche/v1/recherche.md`');
    expect(version).toMatchObject({ instructions: RECHERCHE_DEFAULT_INSTRUCTIONS, inputList: [] });
  });

  it("replaces the default Instructions with the Candidate's own, keeping the fixed part", async () => {
    const instructions = 'Insiste sur la justice des mineurs dans le ressort de Béthune.\n';
    const aiSession = createFakeAiSession({ fileByName: { 'recherche.md': RECHERCHE } });
    const { actions, dataDirectory } = await detectPostings(aiSession);
    mkdirSync(path.join(dataDirectory, 'candidates/lea/instructions'));
    writeFileSync(path.join(dataDirectory, 'candidates/lea/instructions/recherche.md'), instructions);

    const { version } = await runRecherche(actions);

    expect(aiSession.headlessSessionList[0]?.instructions).toBe(instructions);
    expect(aiSession.headlessSessionList[0]?.fixedPrompt).toContain("N'invente jamais un fait.");
    expect(version?.instructions).toBe(instructions);
  });
});

describe('a launch refused', () => {
  it('refuses an unknown Posting without launching Claude', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await detectPostings(aiSession);

    await expect(actions.runModule({ module: 'recherche', reference: '2026-0000000' })).rejects.toThrow(
      /Offre inconnue : 2026-0000000/,
    );
    expect(aiSession.headlessSessionList).toEqual([]);
  });

  it('refuses a module that does not exist, without launching Claude', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await detectPostings(aiSession);

    await expect(actions.runModule({ module: 'inconnu', reference: REFERENCE })).rejects.toThrow(
      'Module inconnu : inconnu. Modules : recherche, lettre, fiche, visualisation.',
    );
    expect(aiSession.headlessSessionList).toEqual([]);
  });
});

describe('a Recherche that fails', () => {
  it.each([
    { problem: 'the expected file is absent', plannedRun: {}, log: /recherche\/v1\/recherche\.md est absent/ },
    {
      problem: 'the expected file is empty',
      plannedRun: { fileByName: { 'recherche.md': ' \n' } },
      log: /recherche\/v1\/recherche\.md est vide/,
    },
    {
      problem: 'the expected file has no sources',
      plannedRun: { fileByName: { 'recherche.md': '# Recherche\n\nAucune source.\n' } },
      log: /recherche\/v1\/recherche\.md est mal formé/,
    },
    {
      problem: 'the Claude session fails',
      plannedRun: { fileByName: { 'recherche.md': RECHERCHE }, isSuccess: false },
      log: /Claude Code a rencontré une erreur/,
    },
  ])('puts the Version and the job « en échec » when $problem', async ({ plannedRun, log }) => {
    const { actions } = await detectPostings(createFakeAiSession(plannedRun));

    const job = await runRecherche(actions);

    expect(job.state).toBe('failed');
    expect(job.log).toMatch(log);
    expect(job.version).toMatchObject({ number: 1, state: 'failed', isRetenue: false });
  });

  it('keeps the Version retenue when a new launch fails, and can be launched again', async () => {
    const recherche = { fileByName: { 'recherche.md': RECHERCHE } };
    const { actions } = await detectPostings(createFakeAiSession(recherche, {}, recherche));

    await runRecherche(actions);
    await runRecherche(actions);
    const afterFailureVersionList = await actions.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    await runRecherche(actions);

    expect(afterFailureVersionList.map(({ number, state, isRetenue }) => ({ number, state, isRetenue }))).toEqual([
      { number: 1, state: 'ready', isRetenue: true },
      { number: 2, state: 'failed', isRetenue: false },
    ]);
    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    expect(versionList.map(({ number, state, isRetenue }) => ({ number, state, isRetenue }))).toEqual([
      { number: 1, state: 'ready', isRetenue: false },
      { number: 2, state: 'failed', isRetenue: false },
      { number: 3, state: 'ready', isRetenue: true },
    ]);
  });

  // An Applied Posting keeps the Lettre that was sent (spec « Versions »)
  it('refuses to change the Lettre retenue of an Applied Posting', async () => {
    const { actions } = await detectPostings(createFakeAiSession());
    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });

    await expect(actions.retenirVersion({ reference: REFERENCE, artefact: 'lettre', number: 1 })).rejects.toThrow(
      /L'Offre 2026-2445600 a été Postulée : sa Lettre retenue est figée/,
    );
  });

  it('refuses to retain a Version « en échec »', async () => {
    const { actions } = await detectPostings(createFakeAiSession({}));
    await runRecherche(actions);

    await expect(actions.retenirVersion({ reference: REFERENCE, artefact: 'recherche', number: 1 })).rejects.toThrow(
      /recherche v1 de l'Offre 2026-2445600 est en échec/,
    );
  });
});
