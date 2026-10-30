import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';
import { FICHE_ENTRETIEN_DEFAULT_INSTRUCTIONS } from '#/modules/fiche-entretien/instructions.ts';
import { LETTRE_DEFAULT_INSTRUCTIONS } from '#/modules/lettre/instructions.ts';
import { RECHERCHE_DEFAULT_INSTRUCTIONS } from '#/modules/recherche/instructions.ts';
import { VISUALISATION_DEFAULT_INSTRUCTIONS } from '#/modules/visualisation/instructions.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createRecordedFetch } from './recorded-http.ts';

// The Béthune Offre of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RECHERCHE_RUN = {
  fileByName: { 'recherche.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

async function openActions(aiSession = createFakeAiSession()) {
  const dataDirectory = createDataDirectory();
  return createActions({ dataDirectory, aiSession, fetch: createRecordedFetch().fetch });
}

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runRecherche(actions: Actions) {
  await actions.runModule({ module: 'recherche', reference: REFERENCE });
  await actions.runQueuedJobs();
}

describe('instructions', () => {
  it('shows the default Instructions of each module, and none of the Candidate yet', async () => {
    const actions = await openActions();

    const instructionsList = await actions.listInstructions({ candidateId: 'lea' });

    expect(instructionsList).toEqual([
      { module: 'recherche', defaultInstructions: RECHERCHE_DEFAULT_INSTRUCTIONS, candidateInstructions: null },
      { module: 'lettre', defaultInstructions: LETTRE_DEFAULT_INSTRUCTIONS, candidateInstructions: null },
      {
        module: 'fiche_entretien',
        defaultInstructions: FICHE_ENTRETIEN_DEFAULT_INSTRUCTIONS,
        candidateInstructions: null,
      },
      { module: 'visualisation', defaultInstructions: VISUALISATION_DEFAULT_INSTRUCTIONS, candidateInstructions: null },
    ]);
  });

  it("creates the Candidate's own Instructions for a module, then modifies them", async () => {
    const actions = await openActions();

    await actions.saveInstructions({ candidateId: 'lea', module: 'lettre', instructions: 'Une lettre courte.\n' });
    await actions.saveInstructions({ candidateId: 'lea', module: 'lettre', instructions: 'Une lettre très courte.\n' });

    expect(await actions.listInstructions({ candidateId: 'lea' })).toEqual([
      { module: 'recherche', defaultInstructions: RECHERCHE_DEFAULT_INSTRUCTIONS, candidateInstructions: null },
      {
        module: 'lettre',
        defaultInstructions: LETTRE_DEFAULT_INSTRUCTIONS,
        candidateInstructions: 'Une lettre très courte.\n',
      },
      {
        module: 'fiche_entretien',
        defaultInstructions: FICHE_ENTRETIEN_DEFAULT_INSTRUCTIONS,
        candidateInstructions: null,
      },
      { module: 'visualisation', defaultInstructions: VISUALISATION_DEFAULT_INSTRUCTIONS, candidateInstructions: null },
    ]);
  });

  // jf instructions lea fiche, like jf run fiche
  it('reads the Instructions of one module, named by its Artefact or its alias', async () => {
    const actions = await openActions();
    await actions.saveInstructions({ candidateId: 'lea', module: 'fiche', instructions: 'Dix questions.\n' });

    expect([
      await actions.readInstructions({ candidateId: 'lea', module: 'fiche' }),
      await actions.readInstructions({ candidateId: 'lea', module: 'fiche_entretien' }),
    ]).toEqual([
      {
        module: 'fiche_entretien',
        defaultInstructions: FICHE_ENTRETIEN_DEFAULT_INSTRUCTIONS,
        candidateInstructions: 'Dix questions.\n',
      },
      {
        module: 'fiche_entretien',
        defaultInstructions: FICHE_ENTRETIEN_DEFAULT_INSTRUCTIONS,
        candidateInstructions: 'Dix questions.\n',
      },
    ]);
    await expect(actions.readInstructions({ candidateId: 'lea', module: 'lettr' })).rejects.toThrow(
      'Module inconnu : lettr. Modules : recherche, lettre, fiche, visualisation.',
    );
  });

  it("goes back to the default Instructions once the Candidate's own are deleted", async () => {
    const actions = await openActions();
    await actions.saveInstructions({ candidateId: 'lea', module: 'recherche', instructions: 'Creuse la ville.\n' });

    await actions.deleteInstructions({ candidateId: 'lea', module: 'recherche' });

    const [recherche] = await actions.listInstructions({ candidateId: 'lea' });
    expect(recherche).toEqual({
      module: 'recherche',
      defaultInstructions: RECHERCHE_DEFAULT_INSTRUCTIONS,
      candidateInstructions: null,
    });
  });

  it("tells for each Version whether it comes from the default Instructions or the Candidate's own", async () => {
    const actions = await openActions(createFakeAiSession(RECHERCHE_RUN, RECHERCHE_RUN));
    await actions.detect();

    await runRecherche(actions);
    await actions.saveInstructions({ candidateId: 'lea', module: 'recherche', instructions: 'Creuse la ville.\n' });
    await runRecherche(actions);

    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    expect(
      versionList.map(({ number, instructions, hasCandidateInstructions }) => ({
        number,
        instructions,
        hasCandidateInstructions,
      })),
    ).toEqual([
      { number: 1, instructions: RECHERCHE_DEFAULT_INSTRUCTIONS, hasCandidateInstructions: false },
      { number: 2, instructions: 'Creuse la ville.\n', hasCandidateInstructions: true },
    ]);
  });

  it('refuses Instructions for a module that does not exist, and keeps none', async () => {
    const actions = await openActions();

    await expect(
      actions.saveInstructions({ candidateId: 'lea', module: 'inconnu', instructions: 'Courte.\n' }),
    ).rejects.toThrow('Module inconnu : inconnu. Modules : recherche, lettre, fiche, visualisation.');
    expect(await actions.listInstructions({ candidateId: 'lea' })).toMatchObject([
      { candidateInstructions: null },
      { candidateInstructions: null },
      { candidateInstructions: null },
      { candidateInstructions: null },
    ]);
  });

  it('refuses the Instructions of an unknown Candidate', async () => {
    const actions = await openActions();

    await expect(actions.listInstructions({ candidateId: 'vincent' })).rejects.toThrow(/Candidat inconnu : vincent/);
  });
});
