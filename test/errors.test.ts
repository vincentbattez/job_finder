import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';
import { ERROR_CATALOGUE } from '#/domain/error.ts';

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

  // The front, the CLI and a test tell which failure it is by its code, whatever its message says
  it.each([
    { name: 'an unknown job', call: (actions: Actions) => actions.followJob({ jobId: 999 }), code: 'unknown_job' },
    {
      name: 'an unknown Posting',
      call: (actions: Actions) => actions.readPosting({ reference: '2000-0000000' }),
      code: 'unknown_posting',
    },
    {
      name: 'a mistyped Artifact',
      call: (actions: Actions) => actions.listVersions({ reference: REFERENCE, artifact: 'lettr' }),
      code: 'unknown_artifact',
    },
  ])('carries the code of $name', async ({ call, code }) => {
    const { actions } = await detectPostings();

    await expect(call(actions)).rejects.toMatchObject({ code });
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

// What a mistyped command or a forged form sends: nothing, or a number that is none
const ABSURD_INPUT_LIST = [{}, { number: 'vx' }, { reference: REFERENCE, artifact: 'research', number: 'vx' }];

// Every action, those added later included, refuses an input it cannot read under a code of the
// catalogue, in French, never as the JSON of a ZodError (CODING_STANDARDS “Visible failure”)
describe('an absurd input', () => {
  it('is refused by every action under a code of the catalogue, never as JSON', async () => {
    const { actions } = await detectPostings();
    const refusalList: { name: string; code: unknown; message: string }[] = [];

    for (const [name, action] of Object.entries(actions)) {
      for (const input of ABSURD_INPUT_LIST) {
        try {
          await action(input);
        } catch (error) {
          refusalList.push({
            name,
            code: error instanceof Error && 'code' in error ? error.code : undefined,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    expect(refusalList.length).toBeGreaterThan(Object.keys(actions).length);
    expect(refusalList.filter(({ code }) => typeof code !== 'string' || !Object.hasOwn(ERROR_CATALOGUE, code))).toEqual(
      [],
    );
    expect(
      refusalList.filter(({ message }) => message.trimStart().startsWith('[') || message.includes('"code":')),
    ).toEqual([]);
  });

  it('names the input to correct, in French', async () => {
    const { actions } = await detectPostings();

    await expect(
      actions.chooseVersion({ reference: REFERENCE, artifact: 'research', number: 'vx' }),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      message:
        'Saisie invalide :\n« number » : Entrée invalide : nombre attendu, NaN reçu\nLa corriger, puis réessayer.',
    });
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
    await actions.changeStatus({ reference, status: 'applied' });

    await expect(actions.changeStatus({ reference, status: 'to_apply' })).rejects.toThrow(
      `Posting ${reference} was Applied: it never goes back to To Apply, since its Chosen Letter is the one sent.`,
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

// jf prints the code of a failure before its message, and exits with code 1 (CODING_STANDARDS “Visible failure”)
describe('a jf error', () => {
  it('shows its code and its message, with exit code 1', () => {
    const jfPath = path.join(import.meta.dirname, '..', 'src', 'cli', 'jf.ts');

    let failure: unknown;
    try {
      execFileSync(process.execPath, [jfPath, 'frobnicate'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      status: 1,
      stderr: '[unknown_command] Commande inconnue : frobnicate. « jf help » liste les commandes.\n',
    });
  });
});
