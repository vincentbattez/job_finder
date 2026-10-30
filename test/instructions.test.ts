import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';
import { INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS } from '#/modules/interview-brief/instructions.ts';
import { LETTER_DEFAULT_INSTRUCTIONS } from '#/modules/letter/instructions.ts';
import { RESEARCH_DEFAULT_INSTRUCTIONS } from '#/modules/research/instructions.ts';
import { VISUALIZATION_DEFAULT_INSTRUCTIONS } from '#/modules/visualization/instructions.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createRecordedFetch } from './recorded-http.ts';

// The Béthune Posting of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RESEARCH_RUN = {
  fileByName: { 'research.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

async function openActions(aiSession = createFakeAiSession()) {
  const dataDirectory = createDataDirectory();
  return createActions({ dataDirectory, aiSession, fetch: createRecordedFetch().fetch });
}

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runResearch(actions: Actions) {
  await actions.runModule({ module: 'research', reference: REFERENCE });
  await actions.runQueuedJobs();
}

describe('instructions', () => {
  it('shows the default Instructions of each module, and none of the Candidate yet', async () => {
    const actions = await openActions();

    const instructionsList = await actions.listInstructions({ candidateId: 'lea' });

    expect(instructionsList).toEqual([
      { module: 'research', defaultInstructions: RESEARCH_DEFAULT_INSTRUCTIONS, candidateInstructions: null },
      { module: 'letter', defaultInstructions: LETTER_DEFAULT_INSTRUCTIONS, candidateInstructions: null },
      {
        module: 'interview_brief',
        defaultInstructions: INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS,
        candidateInstructions: null,
      },
      { module: 'visualization', defaultInstructions: VISUALIZATION_DEFAULT_INSTRUCTIONS, candidateInstructions: null },
    ]);
  });

  it("creates the Candidate's own Instructions for a module, then modifies them", async () => {
    const actions = await openActions();

    await actions.saveInstructions({ candidateId: 'lea', module: 'letter', instructions: 'Une lettre courte.\n' });
    await actions.saveInstructions({ candidateId: 'lea', module: 'letter', instructions: 'Une lettre très courte.\n' });

    expect(await actions.listInstructions({ candidateId: 'lea' })).toEqual([
      { module: 'research', defaultInstructions: RESEARCH_DEFAULT_INSTRUCTIONS, candidateInstructions: null },
      {
        module: 'letter',
        defaultInstructions: LETTER_DEFAULT_INSTRUCTIONS,
        candidateInstructions: 'Une lettre très courte.\n',
      },
      {
        module: 'interview_brief',
        defaultInstructions: INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS,
        candidateInstructions: null,
      },
      { module: 'visualization', defaultInstructions: VISUALIZATION_DEFAULT_INSTRUCTIONS, candidateInstructions: null },
    ]);
  });

  // jf instructions lea brief, like jf run brief
  it('reads the Instructions of one module, named by its Artifact or its alias', async () => {
    const actions = await openActions();
    await actions.saveInstructions({ candidateId: 'lea', module: 'brief', instructions: 'Dix questions.\n' });

    expect([
      await actions.readInstructions({ candidateId: 'lea', module: 'brief' }),
      await actions.readInstructions({ candidateId: 'lea', module: 'interview_brief' }),
    ]).toEqual([
      {
        module: 'interview_brief',
        defaultInstructions: INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS,
        candidateInstructions: 'Dix questions.\n',
      },
      {
        module: 'interview_brief',
        defaultInstructions: INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS,
        candidateInstructions: 'Dix questions.\n',
      },
    ]);
    await expect(actions.readInstructions({ candidateId: 'lea', module: 'lettr' })).rejects.toThrow(
      'Module inconnu : lettr. Modules : research, letter, brief, visualization.',
    );
  });

  it("goes back to the default Instructions once the Candidate's own are deleted", async () => {
    const actions = await openActions();
    await actions.saveInstructions({ candidateId: 'lea', module: 'research', instructions: 'Creuse la ville.\n' });

    await actions.deleteInstructions({ candidateId: 'lea', module: 'research' });

    const [research] = await actions.listInstructions({ candidateId: 'lea' });
    expect(research).toEqual({
      module: 'research',
      defaultInstructions: RESEARCH_DEFAULT_INSTRUCTIONS,
      candidateInstructions: null,
    });
  });

  it("tells for each Version whether it comes from the default Instructions or the Candidate's own", async () => {
    const actions = await openActions(createFakeAiSession(RESEARCH_RUN, RESEARCH_RUN));
    await actions.detect();

    await runResearch(actions);
    await actions.saveInstructions({ candidateId: 'lea', module: 'research', instructions: 'Creuse la ville.\n' });
    await runResearch(actions);

    const versionList = await actions.listVersions({ reference: REFERENCE, artifact: 'research' });
    expect(
      versionList.map(({ number, instructions, hasCandidateInstructions }) => ({
        number,
        instructions,
        hasCandidateInstructions,
      })),
    ).toEqual([
      { number: 1, instructions: RESEARCH_DEFAULT_INSTRUCTIONS, hasCandidateInstructions: false },
      { number: 2, instructions: 'Creuse la ville.\n', hasCandidateInstructions: true },
    ]);
  });

  it('refuses Instructions for a module that does not exist, and keeps none', async () => {
    const actions = await openActions();

    await expect(
      actions.saveInstructions({ candidateId: 'lea', module: 'inconnu', instructions: 'Courte.\n' }),
    ).rejects.toThrow('Module inconnu : inconnu. Modules : research, letter, brief, visualization.');
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
