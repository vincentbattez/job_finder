import { utimesSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { openContext } from '#/actions/context.ts';
import { createInterviewActions } from '#/actions/interviews.ts';
import { createNotesActions } from '#/actions/notes.ts';
import { findWorkerFailure } from '#/actions/stalled-job.ts';
import { createStatusActions } from '#/actions/status.ts';
import { createArtifacts } from '#/artifact/index.ts';
import { PROFILE_FILE_NAME_SCHEMA } from '#/domain/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import { copyDetectedDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RESEARCH_RUN = { fileByName: { 'research.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } };
const LETTER_RUN = {
  fileByName: {
    'draft.md': 'Madame la Présidente,\n\nJe souhaite rejoindre le tribunal pour enfants de Béthune.\n',
    'recipients.json': JSON.stringify({
      to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
      ccList: [],
      salutation: { text: 'Madame la Présidente,', source: 'contact1' },
      justification: 'Le mail de candidature est celui de la présidence.',
    }),
  },
};
const PORTRAIT_RUN = { fileByName: { 'portrait.md': '# Portrait\n\nMme Durand, RH de la cour d’appel.\n' } };
const BRIEF_RUN = { fileByName: { 'interview-brief.md': "# Fiche d'entretien\n\n## À réviser\n" } };

const INTERVIEW = {
  start: '2026-11-19T14:00',
  place: 'Tribunal judiciaire, Béthune',
  interviewers: 'Mme Durand, responsable RH de la cour d’appel',
};

type PlannedRunList = Parameters<typeof createFakeAiSession>;

// The Artifact module on a copy of the detected data folder, the AI session faked: a Chosen Version is
// only obtained through its interface, by queuing a run, claiming the job and running it
async function openArtifacts(...plannedRunList: PlannedRunList) {
  const aiSession = createFakeAiSession(...plannedRunList);
  const context = await openContext({ dataDirectory: copyDetectedDataDirectory(), aiSession });
  const { artifacts, workspace } = context;
  const statusActions = createStatusActions(context);
  const interviewActions = createInterviewActions(context);

  async function runNextJob() {
    const job = await workspace.claimNextJob();
    return job === null || job.module === 'conversion' || job.module === 'extraction'
      ? expect.unreachable('an Artifact job is queued')
      : artifacts.run({ ...job, module: job.module });
  }

  // Each run in order, queued then run, as the worker would
  async function produce(...nameList: Parameters<typeof artifacts.find>[0][]) {
    for (const name of nameList) {
      const handle = await artifacts.find(name);
      await handle.queueRun();
      await runNextJob();
    }
  }

  return {
    context,
    artifacts,
    aiSession,
    runNextJob,
    produce,
    apply: async (reference = REFERENCE) => {
      await statusActions.keep({ reference });
      await statusActions.changeStatus({ reference, status: 'applied' });
    },
    // An Interview needs an Application
    addInterview: async () => {
      await statusActions.keep({ reference: REFERENCE });
      await statusActions.changeStatus({ reference: REFERENCE, status: 'applied' });
      await interviewActions.addInterview({ reference: REFERENCE, ...INTERVIEW });
    },
  };
}

// The Interview, its Portrait and its Interview Brief, on a Posting with a Chosen
// Research and a Chosen Letter
async function openPreparedInterview(...extraRunList: PlannedRunList) {
  const opened = await openArtifacts(RESEARCH_RUN, LETTER_RUN, PORTRAIT_RUN, BRIEF_RUN, ...extraRunList);
  await opened.produce({ reference: REFERENCE, artifact: 'research' }, { reference: REFERENCE, artifact: 'letter' });
  await opened.addInterview();
  await opened.produce(
    { reference: REFERENCE, artifact: 'portrait', interview: 1 },
    { reference: REFERENCE, artifact: 'interview_brief', interview: 1 },
  );
  return opened;
}

describe('finding an Artifact', () => {
  it.each([
    { case: 'an unknown Posting', name: { reference: '2026-0000000', artifact: 'research' }, code: 'unknown_posting' },
    { case: 'an unknown Artifact', name: { reference: REFERENCE, artifact: 'inconnu' }, code: 'unknown_artifact' },
    { case: 'an unknown module', name: { reference: REFERENCE, module: 'inconnu' }, code: 'unknown_module' },
    {
      case: 'an Interview for an Artifact of the Posting',
      name: { reference: REFERENCE, artifact: 'research', interview: 1 },
      code: 'interview_not_expected',
    },
    {
      case: 'no Interview for an Artifact attached to one',
      name: { reference: REFERENCE, artifact: 'portrait' },
      code: 'interview_required',
    },
    {
      case: 'an Interview the Posting does not have',
      name: { reference: REFERENCE, artifact: 'interview_brief', interview: 2 },
      code: 'unknown_interview',
    },
  ])('refuses $case', async ({ name, code }) => {
    const { artifacts, addInterview } = await openArtifacts();
    await addInterview();

    await expect(artifacts.find(name)).rejects.toMatchObject({ code });
  });

  it('names the Artifact by the alias of its module, as an Artifact or as a module', async () => {
    const { artifacts, addInterview } = await openArtifacts();
    await addInterview();

    const handleList = await Promise.all([
      artifacts.find({ reference: REFERENCE, artifact: 'brief', interview: 1 }),
      artifacts.find({ reference: REFERENCE, module: 'brief', interview: 1 }),
    ]);

    expect(handleList.map(({ artifact, interview }) => ({ artifact, number: interview?.number }))).toEqual([
      { artifact: 'interview_brief', number: 1 },
      { artifact: 'interview_brief', number: 1 },
    ]);
  });

  it('lists those of the Posting, then those of each Interview, by date', async () => {
    const { artifacts, context, addInterview } = await openArtifacts();
    await addInterview();
    const [posting] = await context.workspace.findPostings(REFERENCE);
    if (posting === undefined) {
      return expect.unreachable('the Béthune Posting was detected');
    }

    const handleList = await artifacts.listOf(posting);

    expect(handleList.map(({ artifact, interview }) => `${artifact}${interview === null ? '' : ' 1'}`)).toEqual([
      'research',
      'letter',
      'portrait 1',
      'interview_brief 1',
    ]);
  });
});

describe('running an Artifact', () => {
  it('makes the Version of a run the Chosen Version, numbered on its Interview', async () => {
    const { artifacts } = await openPreparedInterview();

    const handle = await artifacts.find({ reference: REFERENCE, artifact: 'interview_brief', interview: 1 });

    expect(handle.chosenVersion).toMatchObject({ number: 1, state: 'ready', interview: { number: 1 } });
  });

  it.each([
    {
      case: 'the Letter without a Chosen Research',
      name: { reference: REFERENCE, artifact: 'letter' },
      command: `jf run research ${REFERENCE}`,
    },
    {
      case: 'the Interview Brief without a Chosen Research',
      name: { reference: REFERENCE, artifact: 'interview_brief', interview: 1 },
      command: `jf run research ${REFERENCE}`,
    },
  ])('refuses $case, naming the command that produces it, and queues nothing', async ({ name, command }) => {
    const { artifacts, addInterview } = await openArtifacts();
    // An Interview needs an Application, which freezes the Letter: only for an Artifact attached to one
    if ('interview' in name) {
      await addInterview();
    }
    const handle = await artifacts.find(name);

    const run = await handle.readRun();

    expect(run).toMatchObject({ refusal: { code: 'missing_artifact', values: { command } }, prompt: null });
    await expect(handle.queueRun()).rejects.toMatchObject({ code: 'missing_artifact' });
    expect(await handle.readState()).toMatchObject({ state: 'absent' });
  });

  it.each([
    { artifact: 'research', interview: undefined },
    { artifact: 'portrait', interview: 1 },
  ])('runs the $artifact, which requires nothing, with its Prompt', async (name) => {
    const { artifacts, addInterview } = await openArtifacts();
    await addInterview();
    const handle = await artifacts.find({ reference: REFERENCE, ...name });

    const { refusal, prompt } = await handle.readRun();

    expect(refusal).toBeNull();
    expect(prompt?.fixedPart).toMatch(/\S/);
  });

  it('refuses a new Letter once the Posting is Applied: the Letter sent is frozen', async () => {
    const { artifacts, produce, apply } = await openArtifacts(RESEARCH_RUN, LETTER_RUN);
    await produce({ reference: REFERENCE, artifact: 'research' }, { reference: REFERENCE, artifact: 'letter' });
    await apply();
    const handle = await artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    expect(await handle.readRun()).toMatchObject({ refusal: { code: 'letter_frozen' }, prompt: null });
    await expect(handle.queueRun()).rejects.toMatchObject({ code: 'letter_frozen' });
  });

  it('refuses at its run a Letter queued before the Posting became Applied, before writing anything', async () => {
    const { artifacts, produce, apply, runNextJob, aiSession } = await openArtifacts(RESEARCH_RUN, LETTER_RUN);
    await produce({ reference: REFERENCE, artifact: 'research' });
    const letter = await artifacts.find({ reference: REFERENCE, artifact: 'letter' });
    await letter.queueRun();
    await apply();

    await expect(runNextJob()).rejects.toMatchObject({ code: 'letter_frozen' });
    expect(aiSession.headlessSessionList).toHaveLength(1);
    const { versionList } = await artifacts.find({ reference: REFERENCE, artifact: 'letter' });
    expect(versionList).toEqual([]);
  });

  // The Posting page reads the refusal for the button and for the Prompt: it is read once per handle
  it('computes the refusal once per handle', async () => {
    const { context } = await openArtifacts();
    let researchReadCount = 0;
    const workspace: Workspace = {
      ...context.workspace,
      listVersions(...argumentList) {
        researchReadCount += argumentList[1] === 'research' ? 1 : 0;
        return context.workspace.listVersions(...argumentList);
      },
    };
    const artifacts = createArtifacts({
      ...context,
      workspace,
      findWorkerFailure: (job, locale) => findWorkerFailure(workspace, job, locale),
    });
    const handle = await artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    await handle.describe();
    await handle.readRun();
    await expect(handle.queueRun()).rejects.toMatchObject({ code: 'missing_artifact' });

    expect(researchReadCount).toBe(1);
  });
});

describe('editing an Artifact', () => {
  it('accepts the Chosen Version of an Artifact corrected by hand', async () => {
    const { artifacts } = await openPreparedInterview();

    const handleList = await Promise.all([
      artifacts.find({ reference: REFERENCE, artifact: 'research' }),
      artifacts.find({ reference: REFERENCE, artifact: 'portrait', interview: 1 }),
      artifacts.find({ reference: REFERENCE, artifact: 'interview_brief', interview: 1 }),
    ]);

    expect(handleList.map(({ editRefusal }) => editRefusal)).toEqual([null, null, null]);
  });

  it.each([
    {
      case: 'the Letter, sent once the Posting is Applied',
      name: { reference: REFERENCE, artifact: 'letter' },
      code: 'letter_frozen',
    },
  ])('refuses $case', async ({ name, code }) => {
    const { artifacts, aiSession } = await openPreparedInterview();
    const handle = await artifacts.find(name);

    expect(handle.editRefusal).toMatchObject({ code });
    expect(() => {
      handle.openForEdition();
    }).toThrow(expect.objectContaining({ code }));
    expect(aiSession.interactiveSessionList).toEqual([]);
  });

  it.each([
    { case: 'never produced', plannedRunList: [] },
    { case: 'whose only Version failed', plannedRunList: [{}] },
  ])('refuses an Artifact $case, naming the command that produces it', async ({ plannedRunList }) => {
    const { artifacts, addInterview, produce } = await openArtifacts(...plannedRunList);
    await addInterview();
    const name = { reference: REFERENCE, artifact: 'portrait', interview: 1 };
    if (plannedRunList.length > 0) {
      await produce(name);
    }

    const handle = await artifacts.find(name);

    expect(handle.editRefusal).toMatchObject({
      code: 'no_chosen_version_to_edit',
      values: { command: `jf run portrait ${REFERENCE} 1` },
    });
  });

  it('keeps the read-only files every module declares out of reach of jf edit', async () => {
    const { artifacts, aiSession } = await openPreparedInterview();

    const research = await artifacts.find({ reference: REFERENCE, artifact: 'research' });
    research.openForEdition();

    expect(aiSession.interactiveSessionList[0]?.readOnlyPathList).toEqual([
      expect.stringMatching(/\/\*\*\/draft\.md$/),
    ]);
  });
});

describe('saving a document', () => {
  it.each([
    { case: 'the Draft, which the Letter module declares read-only', fileName: 'draft.md', code: 'draft_not_editable' },
    { case: 'a file that is not one of the Version', fileName: 'notes.md', code: 'not_a_version_file' },
    {
      case: 'a path out of the Version, such as the Job Description',
      fileName: '../../job-description.md',
      code: 'not_a_version_file',
    },
  ])('refuses $case', async ({ fileName, code }) => {
    const { artifacts, produce } = await openArtifacts(RESEARCH_RUN, LETTER_RUN);
    await produce({ reference: REFERENCE, artifact: 'research' }, { reference: REFERENCE, artifact: 'letter' });
    const handle = await artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    expect(() => {
      handle.saveDocument(fileName, '# Corrigé\n');
    }).toThrow(expect.objectContaining({ code }));
  });

  it('checks the edit first: the Letter of an Applied Posting is frozen, its Draft included', async () => {
    const { artifacts, produce, apply } = await openArtifacts(RESEARCH_RUN, LETTER_RUN);
    await produce({ reference: REFERENCE, artifact: 'research' }, { reference: REFERENCE, artifact: 'letter' });
    await apply();
    const handle = await artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    expect(() => {
      handle.saveDocument('draft.md', '# Corrigé\n');
    }).toThrow(expect.objectContaining({ code: 'letter_frozen' }));
  });

  it('tells which document of each Version may be saved: those of the Chosen Version, its read-only ones aside', async () => {
    const { artifacts, produce } = await openArtifacts(RESEARCH_RUN, RESEARCH_RUN, LETTER_RUN);
    await produce(
      { reference: REFERENCE, artifact: 'research' },
      { reference: REFERENCE, artifact: 'research' },
      { reference: REFERENCE, artifact: 'letter' },
    );
    const handleList = await Promise.all([
      artifacts.find({ reference: REFERENCE, artifact: 'research' }),
      artifacts.find({ reference: REFERENCE, artifact: 'letter' }),
    ]);

    expect(
      handleList.flatMap(({ artifact, versionList }) =>
        versionList.map(({ version, documentList }) => ({
          version: `${artifact} v${String(version.number)}`,
          refusalByFile: Object.fromEntries(
            documentList.map(({ fileName, saveRefusal }) => [fileName, saveRefusal?.code ?? null]),
          ),
        })),
      ),
    ).toEqual([
      { version: 'research v1', refusalByFile: { 'research.md': 'no_chosen_version_to_edit' } },
      { version: 'research v2', refusalByFile: { 'research.md': null } },
      { version: 'letter v1', refusalByFile: { 'draft.md': 'draft_not_editable', 'letter.md': null } },
    ]);
  });
});

describe('choosing a Version', () => {
  it('makes a ready Version the Chosen Version', async () => {
    const { artifacts, produce } = await openArtifacts(RESEARCH_RUN, RESEARCH_RUN);
    await produce({ reference: REFERENCE, artifact: 'research' }, { reference: REFERENCE, artifact: 'research' });

    const research = await artifacts.find({ reference: REFERENCE, artifact: 'research' });
    await research.choose(1);

    const { chosenVersion } = await artifacts.find({ reference: REFERENCE, artifact: 'research' });
    expect(chosenVersion?.number).toBe(1);
  });

  it.each([
    { case: 'an unknown Version', number: 3, code: 'unknown_version' },
    { case: 'a failed Version', number: 2, code: 'version_failed' },
  ])('refuses $case', async ({ number, code }) => {
    const { artifacts, produce } = await openArtifacts(RESEARCH_RUN, {});
    await produce({ reference: REFERENCE, artifact: 'research' }, { reference: REFERENCE, artifact: 'research' });
    const handle = await artifacts.find({ reference: REFERENCE, artifact: 'research' });

    expect(handle.versionList.map(({ choiceRefusal }) => choiceRefusal?.code ?? null)).toEqual([
      null,
      'version_failed',
    ]);
    await expect(handle.choose(number)).rejects.toMatchObject({ code });
  });

  it('refuses a Version still running', async () => {
    const { artifacts, runNextJob } = await openArtifacts({ isInterrupted: true });
    const research = await artifacts.find({ reference: REFERENCE, artifact: 'research' });
    await research.queueRun();
    void runNextJob();
    await vi.waitFor(async () => {
      const { versionList } = await artifacts.find({ reference: REFERENCE, artifact: 'research' });
      expect(versionList).toHaveLength(1);
    });

    const handle = await artifacts.find({ reference: REFERENCE, artifact: 'research' });

    await expect(handle.choose(1)).rejects.toMatchObject({ code: 'version_running' });
  });

  it('refuses any Letter once the Posting is Applied, even an unknown one: the Letter sent stays chosen', async () => {
    const { artifacts, produce, apply } = await openArtifacts(RESEARCH_RUN, LETTER_RUN, LETTER_RUN);
    await produce(
      { reference: REFERENCE, artifact: 'research' },
      { reference: REFERENCE, artifact: 'letter' },
      { reference: REFERENCE, artifact: 'letter' },
    );
    await apply();
    const handle = await artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    await expect(handle.choose(1)).rejects.toMatchObject({ code: 'letter_frozen' });
    await expect(handle.choose(9)).rejects.toMatchObject({ code: 'letter_frozen' });
  });
});

const CV = '# CV\n\nLéa Martin, juriste.\n';
const FACTS = '# Faits\n\n## Mobilité\n\n- Lille\n';
const ANNEX = '# Mémoire\n\nLa justice des mineurs.\n';
const DAY_MS = 86_400_000;
// A Letter for another Posting, whose fields hold no address to recommend
const OTHER_LETTER_RUN = {
  fileByName: {
    'draft.md': 'Madame, Monsieur,\n\nJe souhaite rejoindre votre juridiction.\n',
    'recipients.json': JSON.stringify({
      to: null,
      ccList: [],
      salutation: { text: 'Madame, Monsieur,', source: null },
      justification: 'Aucune adresse publiée.',
    }),
  },
};

// Léa's Profile, each Past Letter of it dated by the day it was added: the nth one n days ago
function writeProfile(workspace: Workspace, pastLetterCount = 0): void {
  const now = Date.now();
  const write = (fileName: string, markdown: string, daysAgo = 0) => {
    workspace.saveProfileFile('lea', PROFILE_FILE_NAME_SCHEMA.parse(fileName), markdown);
    const savedAt = new Date(now - daysAgo * DAY_MS);
    utimesSync(path.join(workspace.profileDirectoryOf('lea'), fileName), savedAt, savedAt);
  };
  write('cv.md', CV);
  write('facts.md', FACTS);
  write('annex-thesis.md', ANNEX);
  for (let number = 1; number <= pastLetterCount; number += 1) {
    write(`letter-${String(number)}.md`, `Lettre ${String(number)}\n`, number);
  }
}

// Another Posting of Léa, detected with the Béthune one
async function findOtherReference(workspace: Workspace): Promise<string> {
  const postingList = await workspace.listPostings('lea');
  return postingList.find(({ reference }) => reference !== REFERENCE)?.reference ?? expect.unreachable('two Postings');
}

const LETTER_CORE_KEY_LIST = ['job_description', 'artifact:research', 'profile:cv.md', 'profile:facts.md'];

describe('the Inputs of a run', () => {
  it('resolves each Input of the Letter with its mode, reason, content and word count, checked by default', async () => {
    const opened = await openArtifacts(RESEARCH_RUN);
    writeProfile(opened.context.workspace);
    await opened.produce({ reference: REFERENCE, artifact: 'research' });
    const letter = await opened.artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    const inputList = await letter.readInputs();

    expect(
      inputList.map(({ key, kind, mode, reason, isAvailable, wordCount, isChecked }) => ({
        key,
        kind,
        mode,
        reason,
        isAvailable,
        wordCount,
        isChecked,
      })),
    ).toEqual([
      expect.objectContaining({ key: 'job_description', mode: 'required', reason: 'job_description', isChecked: true }),
      {
        key: 'artifact:research',
        kind: 'artifact',
        mode: 'required',
        reason: 'required_artifact',
        isAvailable: true,
        wordCount: 6,
        isChecked: true,
      },
      {
        key: 'profile:cv.md',
        kind: 'profile_document',
        mode: 'required',
        reason: 'profile_core',
        isAvailable: true,
        wordCount: 5,
        isChecked: true,
      },
      expect.objectContaining({ key: 'profile:facts.md', mode: 'required', reason: 'profile_core' }),
      {
        key: 'profile:annex-thesis.md',
        kind: 'profile_document',
        mode: 'optional',
        reason: null,
        isAvailable: true,
        wordCount: 6,
        isChecked: false,
      },
    ]);
    expect(inputList.find(({ key }) => key === 'profile:cv.md')?.content).toBe(CV);
    expect(inputList[0]?.content).toMatch(/\S/);
  });

  it('tells a required Artifact without a Chosen Version unavailable, with no content', async () => {
    const { artifacts } = await openArtifacts();
    const letter = await artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    const inputList = await letter.readInputs();

    expect(inputList.find(({ key }) => key === 'artifact:research')).toMatchObject({
      mode: 'required',
      isAvailable: false,
      content: '',
      wordCount: 0,
    });
  });

  it('reads for an Interview Brief the optional Artifacts it has, the previous Briefs and the Notes', async () => {
    const { context, artifacts } = await openPreparedInterview();
    await createNotesActions(context).saveNotes({ reference: REFERENCE, notes: 'Parler du stage.' });
    await createInterviewActions(context).addInterview({
      reference: REFERENCE,
      ...INTERVIEW,
      start: '2026-11-26T14:00',
    });
    const brief = await artifacts.find({ reference: REFERENCE, artifact: 'interview_brief', interview: 2 });

    const inputList = await brief.readInputs();

    expect(inputList.map(({ key, mode }) => `${key} ${mode}`)).toEqual([
      'job_description required',
      'artifact:research required',
      'artifact:letter default',
      'artifact:interview_brief@1 default',
      'notes default',
    ]);
  });

  it('makes the Past Letters one set, the Profile’s and the sent ones, and checks the five most recent', async () => {
    const opened = await openArtifacts(RESEARCH_RUN, OTHER_LETTER_RUN);
    writeProfile(opened.context.workspace, 5);
    const otherReference = await findOtherReference(opened.context.workspace);
    await opened.produce(
      { reference: otherReference, artifact: 'research' },
      { reference: otherReference, artifact: 'letter' },
    );
    await opened.apply(otherReference);
    const letter = await opened.artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    const inputList = await letter.readInputs();

    expect(
      inputList
        .filter(({ kind }) => kind === 'past_letter')
        .map(({ key, mode, isChecked }) => ({ key, mode, isChecked })),
    ).toEqual([
      { key: 'profile:letter-1.md', mode: 'default', isChecked: true },
      { key: 'profile:letter-2.md', mode: 'default', isChecked: true },
      { key: 'profile:letter-3.md', mode: 'default', isChecked: true },
      { key: 'profile:letter-4.md', mode: 'default', isChecked: true },
      { key: 'profile:letter-5.md', mode: 'optional', isChecked: false },
      { key: `posting:${otherReference}/letter`, mode: 'default', isChecked: true },
    ]);
  });

  it.each([
    { case: 'an unknown Input', keyList: [...LETTER_CORE_KEY_LIST, 'notes'], code: 'unknown_input' },
    {
      case: 'a required Input left unchecked',
      keyList: LETTER_CORE_KEY_LIST.filter((key) => key !== 'profile:cv.md'),
      code: 'required_input_unchecked',
    },
  ])('refuses $case before queueing', async ({ keyList, code }) => {
    const opened = await openArtifacts(RESEARCH_RUN);
    writeProfile(opened.context.workspace);
    await opened.produce({ reference: REFERENCE, artifact: 'research' });
    const letter = await opened.artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    await expect(letter.queueRun({ inputKeyList: keyList })).rejects.toMatchObject({ code });
    expect(await opened.context.workspace.claimNextJob()).toBeNull();
  });

  it('queues with the default Inputs when none are checked, as jf run does', async () => {
    const opened = await openArtifacts(RESEARCH_RUN);
    writeProfile(opened.context.workspace);
    await opened.produce({ reference: REFERENCE, artifact: 'research' });
    const letter = await opened.artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    const job = await letter.queueRun();

    expect(job.inputKeyList).toEqual(LETTER_CORE_KEY_LIST);
  });

  it('records on the Version the Inputs its run read, and prefills a regeneration with them', async () => {
    const opened = await openArtifacts(RESEARCH_RUN, LETTER_RUN);
    writeProfile(opened.context.workspace, 1);
    await opened.produce({ reference: REFERENCE, artifact: 'research' });
    const checkedList = [...LETTER_CORE_KEY_LIST, 'profile:annex-thesis.md'];
    const letter = await opened.artifacts.find({ reference: REFERENCE, artifact: 'letter' });
    await letter.queueRun({ inputKeyList: checkedList });
    await opened.runNextJob();

    const regeneration = await opened.artifacts.find({ reference: REFERENCE, artifact: 'letter' });

    expect(regeneration.chosenVersion?.inputList).toEqual(
      checkedList.map((key) => ({
        key,
        readVersion:
          key === 'artifact:research'
            ? { artifact: 'research', number: 1, posting: { reference: REFERENCE }, interview: null }
            : null,
      })),
    );
    const inputList = await regeneration.readInputs();
    expect(Object.fromEntries(inputList.map(({ key, isChecked }) => [key, isChecked]))).toEqual({
      job_description: true,
      'artifact:research': true,
      'profile:cv.md': true,
      'profile:facts.md': true,
      'profile:letter-1.md': false,
      'profile:annex-thesis.md': true,
    });
  });

  it('refuses at its run an Input checked at queueing and gone since, before writing anything', async () => {
    const opened = await openArtifacts(RESEARCH_RUN, LETTER_RUN);
    const { workspace } = opened.context;
    writeProfile(workspace);
    await opened.produce({ reference: REFERENCE, artifact: 'research' });
    const letter = await opened.artifacts.find({ reference: REFERENCE, artifact: 'letter' });
    await letter.queueRun({ inputKeyList: [...LETTER_CORE_KEY_LIST, 'profile:annex-thesis.md'] });
    workspace.deleteProfileFile('lea', PROFILE_FILE_NAME_SCHEMA.parse('annex-thesis.md'));

    await expect(opened.runNextJob()).rejects.toMatchObject({ code: 'unknown_input' });
    expect(opened.aiSession.headlessSessionList).toHaveLength(1);
  });
});
