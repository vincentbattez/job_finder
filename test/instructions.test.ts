import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';
import { catalogueOf } from '#/domain/catalogue/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { createRecordedFetch } from './recorded-http.ts';

// Léa's, in French
const { defaultInstructions } = catalogueOf({ locale: 'fr' });
const INTERVIEW_BRIEF_DEFAULT_INSTRUCTIONS = defaultInstructions.interview_brief;
const LETTER_DEFAULT_INSTRUCTIONS = defaultInstructions.letter;
const RESEARCH_DEFAULT_INSTRUCTIONS = defaultInstructions.research;
const VISUALIZATION_DEFAULT_INSTRUCTIONS = defaultInstructions.visualization;

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

// Emma reads the interface in English; the Postings she applies to may still be French ones
async function openActionsWithEmma(aiSession = createFakeAiSession()) {
  const actions = await openActions(aiSession);
  await actions.createCandidate({ id: 'emma', name: 'Emma', locale: 'en' });
  return actions;
}

async function listDefaultInstructions(actions: Actions, candidateId: string) {
  const instructionsList = await actions.listInstructions({ candidateId });
  return instructionsList.map(({ defaultInstructions }) => defaultInstructions);
}

describe('instructions in the locale of the Candidate', () => {
  it('shows each Candidate the default Instructions of their locale', async () => {
    const actions = await openActionsWithEmma();

    const emmaDefaultList = await listDefaultInstructions(actions, 'emma');
    const leaDefaultList = await listDefaultInstructions(actions, 'lea');

    expect(emmaDefaultList[0]).toMatch(/^Start from the Job Description/);
    expect(leaDefaultList[0]).toMatch(/^Pars de la Fiche de poste/);
    for (const [index, emmaDefault] of emmaDefaultList.entries()) {
      expect(emmaDefault).not.toBe(leaDefaultList[index]);
    }
  });
});

// A French Job Description; its reference is a hash of its content, so each Candidate imports her own
// copy of it
const FRENCH_JOB_DESCRIPTION = `# Greffier placé – Tribunal judiciaire de Lille

Le greffier assiste les magistrats du siège et du parquet.
`;

const EXTRACTION_RUN = { fileByName: { 'extraction.json': JSON.stringify({ title: 'Greffier placé' }) } };

async function importThenRunResearch(actions: Actions, candidateId: string) {
  const { posting } = await actions.importJobDescription({
    candidateId,
    fileName: 'greffier-lille.md',
    markdown: `${FRENCH_JOB_DESCRIPTION}\n<!-- ${candidateId} -->\n`,
  });
  await actions.runQueuedJobs();
  await actions.runModule({ module: 'research', reference: posting.reference });
  await actions.runQueuedJobs();
}

const LANGUAGE_RULE = 'Write the Research in the language of the Job Description';

describe('language of the Artifacts', () => {
  it('asks for the language of the Job Description, French here, for an fr and an en Candidate alike', async () => {
    const aiSession = createFakeAiSession(EXTRACTION_RUN, RESEARCH_RUN, EXTRACTION_RUN, RESEARCH_RUN);
    const actions = await openActionsWithEmma(aiSession);

    await importThenRunResearch(actions, 'lea');
    await importThenRunResearch(actions, 'emma');

    const [, leaResearch, , emmaResearch] = aiSession.headlessSessionList;
    expect(leaResearch?.fixedPrompt).toContain(LANGUAGE_RULE);
    expect(emmaResearch?.fixedPrompt).toContain(LANGUAGE_RULE);
    expect(emmaResearch?.fixedPrompt).not.toMatch(/English/);
    expect(leaResearch?.instructions).toMatch(/^Pars de la Fiche de poste/);
    expect(emmaResearch?.instructions).toMatch(/^Start from the Job Description/);
  });

  it("keeps the language of the Job Description over the Candidate's own Instructions", async () => {
    const aiSession = createFakeAiSession(EXTRACTION_RUN, RESEARCH_RUN);
    const actions = await openActionsWithEmma(aiSession);
    await actions.saveInstructions({ candidateId: 'emma', module: 'research', instructions: 'Dig into the city.\n' });

    await importThenRunResearch(actions, 'emma');

    const [, research] = aiSession.headlessSessionList;
    expect(research?.instructions).toBe('Dig into the city.\n');
    expect(research?.fixedPrompt).toContain(LANGUAGE_RULE);
  });
});
