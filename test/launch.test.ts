import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';

import { detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune Posting of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RESEARCH_RUN = {
  fileByName: { 'research.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

async function readStateByArtifact(actions: Actions) {
  const { artifactList } = await actions.readPosting({ reference: REFERENCE });
  return Object.fromEntries(artifactList.map(({ artifact, state }) => [artifact, state]));
}

describe('the état of each Artifact on the Posting page', () => {
  it('is absent, then en cours from the moment its job is queued, then prêt', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN));
    const before = await readStateByArtifact(actions);

    await actions.runModule({ module: 'research', reference: REFERENCE });
    const queued = await readStateByArtifact(actions);
    await actions.runQueuedJobs();

    expect(before).toEqual({
      research: 'absent',
      letter: 'absent',
      interview_brief: 'absent',
      visualization: 'absent',
    });
    expect(queued).toMatchObject({ research: 'in_progress', letter: 'absent' });
    expect(await readStateByArtifact(actions)).toMatchObject({ research: 'ready', letter: 'absent' });
  });

  it('is en échec after a failed run, and en cours again once relaunched', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, { isSuccess: false }));
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();
    const failed = await readStateByArtifact(actions);

    await actions.runModule({ module: 'research', reference: REFERENCE });

    expect(failed).toMatchObject({ research: 'failed' });
    expect(await readStateByArtifact(actions)).toMatchObject({ research: 'in_progress' });
  });
});

async function readModuleByArtifact(actions: Actions) {
  const { artifactList } = await actions.readPosting({ reference: REFERENCE });
  return Object.fromEntries(artifactList.map(({ artifact, module }) => [artifact, module]));
}

describe('the modules the Posting page offers', () => {
  it('offers a module for each Artifact a module produces, held back while an input it needs is missing', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN));
    const before = await readModuleByArtifact(actions);

    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();

    // In the words of the front, beside the button of the missing Artifact: no command to type
    expect(before).toEqual({
      research: { refusal: null },
      letter: {
        refusal:
          "L'Offre 2026-2445600 n'a pas de Recherche retenue, sur laquelle s'appuie la Lettre : lancez d'abord la Recherche.",
      },
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
      letter: { refusal: null },
      interview_brief: { refusal: null },
    });
  });

  it('holds the Letter back once the Posting is Applied', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN));
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();

    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });

    expect(await readModuleByArtifact(actions)).toMatchObject({
      research: { refusal: null },
      letter: { refusal: /a été Postulée : sa Lettre retenue est figée/ },
      // The interview comes after the application
      interview_brief: { refusal: null },
    });
  });
});
