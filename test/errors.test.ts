import { rmSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune Posting of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RESEARCH_RUN = {
  fileByName: { 'research.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

// An error stops the command and says, in French, what to do (CODING_STANDARDS « Échec visible »)
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
