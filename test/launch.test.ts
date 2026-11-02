import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { ARTIFACT_SCHEMA, type Artifact } from '#/domain/index.ts';

import { detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RESEARCH_RUN = {
  fileByName: { 'research.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

// A valid output of each module, so that the Artifacts a module reads exist before it runs
const RUN_BY_ARTIFACT: Record<Artifact, { fileByName: Record<string, string> }> = {
  research: RESEARCH_RUN,
  letter: {
    fileByName: {
      'draft.md': 'Madame la Présidente,\n\nJe souhaite rejoindre le tribunal pour enfants de Béthune.\n',
      'recipients.json': JSON.stringify({
        to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
        ccList: [],
        salutation: { text: 'Madame la Présidente,', source: 'contact1' },
        justification: 'Le mail de candidature est celui de la présidence.',
      }),
    },
  },
  portrait: { fileByName: { 'portrait.md': '# Portrait : M. Lefebvre\n\nJuge des enfants à Béthune.\n' } },
  interview_brief: {
    fileByName: {
      'interview-brief.md': [
        "# Fiche d'entretien : tribunal pour enfants de Béthune",
        "## À réviser\n\n- L'assistance éducative.",
        '## Moyens mnémotechniques\n\n- « PAS » : Protéger, Accompagner, Sanctionner.',
        '## Présentez-vous\n\nTitulaire d’un [à compléter : diplôme], je souhaite rejoindre le tribunal pour enfants.',
        '## Questions probables\n\n- Pourquoi le tribunal pour enfants de Béthune ?\n',
      ].join('\n\n'),
    },
  },
  visualization: {
    fileByName: { 'visualization.html': '<!DOCTYPE html><html lang="fr"><body><h1>PAS</h1></body></html>\n' },
  },
};

// The Artifacts attached to an Interview, which run once the Posting is Applied and has one
const INTERVIEW_ARTIFACT_LIST: readonly Artifact[] = ['portrait', 'interview_brief', 'visualization'];

// Launches a module where its Artifact is attached: on the Posting, or on its first Interview
async function runModule(actions: Actions, module: Artifact) {
  const interview = INTERVIEW_ARTIFACT_LIST.includes(module) ? 1 : undefined;
  await actions.runModule({ module, reference: REFERENCE, interview });
  await actions.runQueuedJobs();
}

// The Artifacts of the Posting, then those of its first Interview, as the Posting page reads them
async function readArtifactList(actions: Actions) {
  const { artifactList, interviewList } = await actions.readPosting({ reference: REFERENCE });
  return [...artifactList, ...(interviewList[0]?.artifactList ?? [])];
}

// The Posting Applied, with a first Interview: its Letter is frozen from then on
async function addInterview(actions: Actions) {
  await actions.changeStatus({ reference: REFERENCE, status: 'applied' });
  await actions.addInterview({ reference: REFERENCE, start: '2026-11-19T14:00', place: 'Béthune', interviewers: '' });
}

// What a failed session says, which the Candidate reads as the reason
const FAILED_RUN = { isSuccess: false, log: 'Claude Code a atteint la limite de son abonnement.' };

// A Job Description the Candidate imports, which the extraction reads
const IMPORTED_JOB_DESCRIPTION =
  '# Greffier placé – Tribunal judiciaire de Lille\n\nLe greffier assiste les magistrats.\n';

// Launches the module, its own session failing, once every Artifact before it is ready; gives its state
// and the failure of its last job, as the Posting page reads them
async function failModule(module: Artifact | 'extraction') {
  if (module === 'extraction') {
    const { actions } = await detectPostings(createFakeAiSession(FAILED_RUN));
    const { posting } = await actions.importJobDescription({
      candidateId: 'lea',
      fileName: 'greffier-lille.md',
      markdown: IMPORTED_JOB_DESCRIPTION,
    });
    await actions.runQueuedJobs();
    const { extraction } = await actions.readPosting({ reference: posting.reference });
    return { state: extraction?.state, failure: { errorCode: extraction?.errorCode, log: extraction?.log } };
  }
  const previousList = ARTIFACT_SCHEMA.options.slice(0, ARTIFACT_SCHEMA.options.indexOf(module));
  const { actions } = await detectPostings(
    createFakeAiSession(...previousList.map((artifact) => RUN_BY_ARTIFACT[artifact]), FAILED_RUN),
  );
  for (const artifact of [...previousList, module]) {
    if (artifact === INTERVIEW_ARTIFACT_LIST[0]) {
      await addInterview(actions);
    }
    await runModule(actions, artifact);
  }
  const artifactList = await readArtifactList(actions);
  const { state, failure } = artifactList.find(({ artifact }) => artifact === module) ?? {};
  return { state, failure };
}

// Whatever the module, a failed job says why, on the Posting page and in jf versions (spec #38)
describe('the failure of a module', () => {
  it.each([
    ...ARTIFACT_SCHEMA.options.map((module) => ({
      module,
      errorCode: 'session_failed',
      message: 'La session Claude Code a échoué',
    })),
    { module: 'extraction', errorCode: 'extraction_session_failed', message: "Claude Code n'a pas relevé les champs" },
  ] as const)('shows why the $module failed, with its code and its log', async ({ module, errorCode, message }) => {
    const { state, failure } = await failModule(module);

    expect(state).toBe('failed');
    expect(failure?.errorCode).toBe(errorCode);
    expect(failure?.log).toContain(message);
    expect(failure?.log).toContain(FAILED_RUN.log);
  });

  it('shows a job that failed before its Version as failed, with its reason, over the previous Version', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, RUN_BY_ARTIFACT.letter));
    for (const module of ['research', 'letter']) {
      await actions.runModule({ module, reference: REFERENCE });
      await actions.runQueuedJobs();
    }
    await actions.runModule({ module: 'letter', reference: REFERENCE });
    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });

    await actions.runQueuedJobs();

    const { artifactList } = await actions.readPosting({ reference: REFERENCE });
    expect(artifactList.find(({ artifact }) => artifact === 'letter')).toMatchObject({
      state: 'failed',
      failure: {
        errorCode: 'letter_frozen',
        log: "L'Offre 2026-2445600 a été Postulée : sa Lettre retenue est figée telle qu'envoyée. Elle ne se modifie plus, ne se régénère plus et ne se remplace plus par une autre Version.",
      },
    });
    // What jf versions prints
    expect(await actions.readArtifactState({ reference: REFERENCE, artifact: 'letter' })).toMatchObject({
      state: 'failed',
      failure: { errorCode: 'letter_frozen', log: /sa Lettre retenue est figée/ },
    });
  });

  it('has no failure once the module succeeds', async () => {
    const { actions } = await detectPostings(createFakeAiSession(FAILED_RUN, RESEARCH_RUN));
    for (let launch = 0; launch < 2; launch += 1) {
      await actions.runModule({ module: 'research', reference: REFERENCE });
      await actions.runQueuedJobs();
    }

    const { artifactList } = await actions.readPosting({ reference: REFERENCE });
    expect(artifactList.find(({ artifact }) => artifact === 'research')).toMatchObject({
      state: 'ready',
      failure: null,
    });
    expect(await actions.readArtifactState({ reference: REFERENCE, artifact: 'research' })).toEqual({
      state: 'ready',
      failure: null,
      notificationFailure: null,
      workerFailure: null,
    });
  });
});

async function readStateByArtifact(actions: Actions) {
  const artifactList = await readArtifactList(actions);
  return Object.fromEntries(artifactList.map(({ artifact, state }) => [artifact, state]));
}

describe('the state of each Artifact on the Posting page', () => {
  it('is absent, then queued from the moment its job is queued, then ready', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN));
    const before = await readStateByArtifact(actions);

    await actions.runModule({ module: 'research', reference: REFERENCE });
    const queued = await readStateByArtifact(actions);
    await actions.runQueuedJobs();

    expect(before).toEqual({ research: 'absent', letter: 'absent' });
    expect(queued).toMatchObject({ research: 'queued', letter: 'absent' });
    expect(await readStateByArtifact(actions)).toMatchObject({ research: 'ready', letter: 'absent' });
  });

  it('is failed after a failed run, and queued again once relaunched', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, { isSuccess: false }));
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();
    const failed = await readStateByArtifact(actions);

    await actions.runModule({ module: 'research', reference: REFERENCE });

    expect(failed).toMatchObject({ research: 'failed' });
    expect(await readStateByArtifact(actions)).toMatchObject({ research: 'queued' });
  });
});

async function readModuleByArtifact(actions: Actions) {
  const artifactList = await readArtifactList(actions);
  return Object.fromEntries(artifactList.map(({ artifact, module }) => [artifact, module]));
}

describe('the modules the Posting page offers', () => {
  it('offers a module for each Artifact a module produces, held back while an input it needs is missing', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN));
    const toApply = await readModuleByArtifact(actions);
    await addInterview(actions);
    const before = await readModuleByArtifact(actions);

    await runModule(actions, 'research');

    // An Interview Brief prepares an Interview, which only an Application has
    expect(Object.keys(toApply)).toEqual(['research', 'letter']);
    // In the words of the front, beside the button of the missing Artifact: no command to type
    expect(Object.keys(before)).toEqual(['research', 'letter', 'portrait', 'interview_brief', 'visualization']);
    expect(before).toMatchObject({
      research: { refusal: null },
      letter: { refusal: /a été Postulée : sa Lettre retenue est figée/ },
      // The Portrait reads the Research when there is one, and runs without it
      portrait: { refusal: null },
      interview_brief: {
        refusal:
          "L'Offre 2026-2445600 n'a pas de Recherche retenue, sur laquelle s'appuie la Fiche d’entretien : lancez d'abord la Recherche.",
      },
      visualization: {
        refusal:
          "L'Offre 2026-2445600 n'a pas de Fiche d’entretien retenue, sur laquelle s'appuie la Visualisation : lancez d'abord la Fiche d’entretien.",
      },
    });
    expect(await readModuleByArtifact(actions)).toMatchObject({
      research: { refusal: null },
      interview_brief: { refusal: null },
    });
    expect(toApply).toMatchObject({
      research: { refusal: null, prompt: { readVersionList: [] } },
      letter: {
        refusal:
          "L'Offre 2026-2445600 n'a pas de Recherche retenue, sur laquelle s'appuie la Lettre : lancez d'abord la Recherche.",
        prompt: null,
      },
    });
  });
});
