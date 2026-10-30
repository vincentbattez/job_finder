import { rmSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createMigratedDataDirectory, detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RESEARCH_RUN = {
  fileByName: { 'research.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

// An error stops the command and says, in French, what to do (CODING_STANDARDS “Visible failure”)
describe('an error', () => {
  it.each([
    { command: 'jf versions', call: 'listVersions' },
    { command: 'jf edit', call: 'openArtifact' },
    { command: 'jf choose', call: 'chooseVersion' },
  ] as const)('names the Artifacts when $command gets a mistyped one', async ({ call }) => {
    const { actions } = await detectPostings();

    await expect(actions[call]({ reference: REFERENCE, artifact: 'lettr', number: '1' })).rejects.toThrow(
      'Artefact inconnu : lettr. Artefacts : research, letter, brief, visualization.',
    );
  });

  it('takes the alias of an Artifact, as jf run does', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN));

    expect(await actions.listVersions({ reference: REFERENCE, artifact: 'brief' })).toEqual([]);
  });

  it('tells where to find the Versions of an Artifact when one is unknown', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN));
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();

    await expect(actions.chooseVersion({ reference: REFERENCE, artifact: 'research', number: 9 })).rejects.toThrow(
      `Version inconnue : research v9 de l'Offre ${REFERENCE}. « jf versions ${REFERENCE} research » liste ses Versions.`,
    );
  });

  it('tells where the number of a job comes from when it is unknown', async () => {
    const { actions } = await detectPostings();

    await expect(actions.followJob({ jobId: 999 })).rejects.toThrow(
      'Job inconnu : 999. Son numéro est celui que « jf run » ou « jf import » a affiché.',
    );
  });

  it('tells how to bring back a Job Description missing from the folder of its Posting', async () => {
    const { actions, dataDirectory } = await detectPostings();
    const postingDirectory = path.join(
      dataDirectory,
      'candidates/lea/postings',
      '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune',
    );
    rmSync(path.join(postingDirectory, 'job-description.md'));

    await expect(actions.readPosting({ reference: REFERENCE })).rejects.toThrow(
      `Fiche de poste introuvable pour l'Offre ${REFERENCE} : ${path.join(postingDirectory, 'job-description.md')}. La remettre à cet emplacement, d'où l'outil la lit.`,
    );
  });
});

// Emma, who reads English, with a Posting she imported
async function createEmma() {
  const actions = await createActions({ dataDirectory: createMigratedDataDirectory() });
  await actions.createCandidate({ id: 'emma', name: 'Emma', locale: 'en' });
  const { posting } = await actions.importJobDescription({
    candidateId: 'emma',
    fileName: 'court-clerk-lille.md',
    markdown: '# Court clerk in Lille\n',
  });
  return { actions, reference: posting.reference };
}

// Emma reads English: an error raised for her speaks English, and still says what to do
describe('an error for an English-speaking Candidate', () => {
  it('refuses a Status the Posting cannot move to, in English', async () => {
    const { actions, reference } = await createEmma();
    await actions.changeStatus({ reference, status: 'archived' });

    await expect(actions.changeStatus({ reference, status: 'applied' })).rejects.toThrow(
      `Posting ${reference} is Archived: it can only move to To Apply.`,
    );
  });

  it('refuses a module whose required Artifact has no Chosen Version, in English', async () => {
    const { actions, reference } = await createEmma();

    await expect(actions.runModule({ module: 'letter', reference })).rejects.toThrow(
      `Posting ${reference} has no Chosen Research, which the Letter relies on. Produce it first: jf run research ${reference}.`,
    );
  });

  it('names the Artifacts when one is mistyped, in English', async () => {
    const { actions, reference } = await createEmma();

    await expect(actions.listVersions({ reference, artifact: 'lettr' })).rejects.toThrow(
      'Unknown Artifact: lettr. Artifacts: research, letter, brief, visualization.',
    );
  });

  it('refuses an empty name, in English', async () => {
    const { actions } = await createEmma();

    await expect(actions.renameCandidate({ candidateId: 'emma', name: ' ' })).rejects.toThrow(
      'The Candidate’s name is empty: fill it in.',
    );
  });
});
