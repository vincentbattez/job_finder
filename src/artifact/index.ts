import path from 'node:path';

import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import type { ErrorCode } from '#/domain/error.ts';
import {
  ARTIFACT_SCHEMA,
  ARTIFACT_STATE_SCHEMA,
  type Artifact,
  type ArtifactState,
  type Candidate,
  type Interview,
  type Job,
  type Locale,
  type Posting,
  type Version,
} from '#/domain/index.ts';
import { STATE_BY_JOB_STATE } from '#/domain/state.ts';
import { composeEditPrompt } from '#/edit/prompt.ts';
import { hasBeenApplied } from '#/status/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import {
  defaultKeysOf,
  findChosenVersion,
  isInitiallyChecked,
  resolveInputs,
  type IInput,
  type ITarget,
} from './inputs.ts';
import { AI_MODULE_BY_ARTIFACT, commandOf, isAttachedToInterview, parseArtifactName } from './registry.ts';
import { previewPrompt, runSession, type JobFailure } from './session.ts';

export { findDefaultInstructions, parseModule } from './registry.ts';
export type { JobFailure } from './session.ts';

// A verdict as data: null when accepted, else the Error Code that refuses and the values of its message
// (ADR-0015), which the front and the CLI read alike
interface IRefusal {
  code: ErrorCode;
  values: Record<string, unknown>;
}

interface IArtifactsOption {
  workspace: Workspace;
  aiSession: IAiSession;
  findPosting: (reference: string) => Promise<Posting>;
  findCandidate: (rawInput: unknown) => Promise<Candidate>;
  // Why a job makes no progress; injected until a job-queue module owns it
  findWorkerFailure: (job: Job, locale: Locale) => Promise<{ errorCode: ErrorCode; message: string } | null>;
}

const STATE_BY_VERSION_STATE = { running: 'in_progress', ready: 'ready', failed: 'failed' } as const;

// The read-only files of every module, which jf edit keeps out of reach of its session
const READ_ONLY_FILE_NAME_LIST = Object.values(AI_MODULE_BY_ARTIFACT).flatMap(({ readOnlyFileList = [] }) =>
  readOnlyFileList.map(({ name }) => name),
);

// An act throws the very refusal its handle exposes
function refuse(refusal: IRefusal | null, locale: Locale): void {
  if (refusal !== null) {
    throw codedError(refusal.code, refusal.values, { locale });
  }
}

// What the Candidate sends, the Letter, is frozen once the Posting was Applied
function freezeOf(posting: Posting, artifact: Artifact): IRefusal | null {
  return AI_MODULE_BY_ARTIFACT[artifact].isFrozenOnceApplied === true && hasBeenApplied(posting)
    ? { code: 'letter_frozen', values: { reference: posting.reference } }
    : null;
}

// What a refusal for a missing Artifact names, with the command that produces it where it is attached
function missingArtifactRefusal(
  { posting: { reference }, interview }: ITarget,
  artifact: Artifact,
  missingArtifact: Artifact,
  locale: Locale,
): IRefusal {
  const tCommon = tFor(locale, 'common');
  return {
    code: 'missing_artifact',
    values: {
      reference,
      missingLabel: tCommon(`artifactLabelByArtifact.${missingArtifact}`),
      moduleLabel: tCommon(`artifactLabelByArtifact.${artifact}`),
      command: commandOf(
        ['run', missingArtifact, reference],
        isAttachedToInterview(missingArtifact) ? interview : null,
      ),
    },
  };
}

// The Inputs a run reads among those resolved, or why they are refused: an Input the run does not have,
// or a required one left unchecked; without keys, those the type checks by default
function checkInputs(
  { posting: { reference } }: ITarget,
  inputList: IInput[],
  keyList: readonly string[] | null,
): { checkedList: IInput[]; refusal: IRefusal | null } {
  const checkedKeyList = keyList ?? defaultKeysOf(inputList);
  const unknownKey = checkedKeyList.find((key) => inputList.every((input) => input.key !== key));
  if (unknownKey !== undefined) {
    return { checkedList: [], refusal: { code: 'unknown_input', values: { reference, key: unknownKey } } };
  }
  const unchecked = inputList.find(({ mode, key }) => mode === 'required' && !checkedKeyList.includes(key));
  if (unchecked !== undefined) {
    return {
      checkedList: [],
      refusal: { code: 'required_input_unchecked', values: { reference, key: unchecked.key } },
    };
  }
  return { checkedList: inputList.filter(({ key }) => checkedKeyList.includes(key)), refusal: null };
}

// The only owner of the Artifact of a Posting or of an Interview, so that a rule of an Artifact changes in
// one place; each act checks its own verdict, so no caller acts past a refusal (ADR-0016)
export function createArtifacts({
  workspace,
  aiSession,
  findPosting,
  findCandidate,
  findWorkerFailure,
}: IArtifactsOption) {
  // Read once for every handle of a request, as the Posting page needs them all
  function jobListReaderOf(posting: Posting): () => Promise<Job[]> {
    let jobList: Promise<Job[]> | undefined;
    return () => (jobList ??= workspace.listJobs(posting));
  }

  // The Interview an Artifact is handled on: one is named for an Artifact attached to an Interview, none
  // for one attached to the Posting
  async function findTarget(
    posting: Posting,
    artifact: Artifact,
    interviewNumber: number | undefined,
    locale: Locale,
  ): Promise<ITarget> {
    const { reference } = posting;
    const values = { reference, artifactLabel: tFor(locale, 'common')(`artifactLabelByArtifact.${artifact}`) };
    if (!isAttachedToInterview(artifact)) {
      if (interviewNumber !== undefined) {
        throw codedError('interview_not_expected', values, { locale });
      }
      return { posting, interview: null };
    }
    if (interviewNumber === undefined) {
      throw codedError('interview_required', values, { locale });
    }
    const interview = await workspace.findInterview(posting, interviewNumber);
    if (interview === null) {
      throw codedError('unknown_interview', { reference, number: interviewNumber }, { locale });
    }
    return { posting, interview };
  }

  // Why the module cannot run now: its Artifact frozen since the Posting was Applied, or an Artifact it
  // requires without a Chosen Version
  async function findRunRefusalOf(target: ITarget, artifact: Artifact, locale: Locale): Promise<IRefusal | null> {
    const freeze = freezeOf(target.posting, artifact);
    if (freeze !== null) {
      return freeze;
    }
    const requiredList = AI_MODULE_BY_ARTIFACT[artifact].requiredArtifactList ?? [];
    for (const required of requiredList) {
      if ((await findChosenVersion(workspace, target, required)) === undefined) {
        return missingArtifactRefusal(target, artifact, required, locale);
      }
    }
    return null;
  }

  // A snapshot of one read, for one request: after an act, the Artifact is found again
  async function handleOf(
    target: ITarget,
    artifact: Artifact,
    candidate: Candidate,
    readJobList: () => Promise<Job[]>,
  ) {
    const { posting, interview } = target;
    const { reference } = posting;
    const { locale } = candidate;
    const aiModule = AI_MODULE_BY_ARTIFACT[artifact];
    const versionList = await workspace.listVersions(posting, artifact, interview);
    const chosenVersion = versionList.find(({ isChosen }) => isChosen);
    const freeze = freezeOf(posting, artifact);

    // Only the Chosen Version is corrected by hand, in place: never a Letter frozen once sent
    function editRefusalOf(version: Version | undefined): IRefusal | null {
      if (freeze !== null) {
        return freeze;
      }
      return version?.isChosen === true
        ? null
        : {
            code: 'no_chosen_version_to_edit',
            values: { reference, artifact, command: commandOf(['run', artifact, reference], interview) },
          };
    }

    // A file the module keeps as the AI wrote it, such as the Draft, stays read-only; the front sends the
    // name back, so nothing else than a file of the Version may be written
    function saveRefusalOf(version: Version | undefined, fileName: string, fileNameList: string[]): IRefusal | null {
      const readOnlyFile = aiModule.readOnlyFileList?.find(({ name }) => name === fileName);
      return (
        editRefusalOf(version) ??
        (readOnlyFile === undefined ? null : { code: readOnlyFile.errorCode, values: { reference } }) ??
        (fileNameList.includes(fileName)
          ? null
          : { code: 'not_a_version_file', values: { fileName, artifact, reference } })
      );
    }

    function unknownVersionRefusal(number: number): IRefusal {
      const command = commandOf(['versions', reference, artifact], interview);
      return { code: 'unknown_version', values: { reference, artifact, number, command } };
    }

    // Only a ready Version can become the Chosen Version, and a Letter frozen once sent stays chosen
    function choiceRefusalOf(number: number): IRefusal | null {
      if (freeze !== null) {
        return freeze;
      }
      const version = versionList.find((entry) => entry.number === number);
      if (version === undefined) {
        return unknownVersionRefusal(number);
      }
      if (version.state === 'ready') {
        return null;
      }
      return {
        code: version.state === 'failed' ? 'version_failed' : 'version_running',
        values: { reference, artifact, number },
      };
    }

    // Computed once per handle: the Posting page reads it for the button and for the Prompt
    let runRefusal: Promise<IRefusal | null> | undefined;
    const findRunRefusal = () => (runRefusal ??= findRunRefusalOf(target, artifact, locale));
    let resolvedInputList: Promise<IInput[]> | undefined;
    const readResolvedInputs = () => (resolvedInputList ??= resolveInputs(workspace, target, artifact));

    // One of its Versions by number, refused when it has none
    function versionOf(number: number): Version {
      const version = versionList.find((entry) => entry.number === number);
      if (version === undefined) {
        const { code, values } = unknownVersionRefusal(number);
        throw codedError(code, values, { locale });
      }
      return version;
    }

    function wordForFront({ code, values }: IRefusal): string {
      return code === 'missing_artifact'
        ? tFor(locale, 'error')('missingArtifactForFront', values)
        : codedError(code, values, { locale }).message;
    }

    const detailVersionList = versionList.map((version) => {
      const documentList = workspace.readVersionDocuments(posting, version);
      const fileNameList = documentList.map(({ fileName }) => fileName);
      return {
        version,
        choiceRefusal: choiceRefusalOf(version.number),
        documentList: documentList.map((document) => ({
          ...document,
          saveRefusal: saveRefusalOf(version, document.fileName, fileNameList),
        })),
      };
    });
    const editRefusal = editRefusalOf(chosenVersion);

    // The Prompt a run started now would receive, or why it is refused: exactly one is set
    async function readRun() {
      const refusal = await findRunRefusal();
      if (refusal !== null) {
        return { refusal, prompt: null };
      }
      const { checkedList } = checkInputs(target, await readResolvedInputs(), null);
      return { refusal, prompt: previewPrompt(workspace, target, artifact, candidate, checkedList) };
    }

    // The state follows the last job, unless a Version came after it: a job refused before creating its
    // Version is failed rather than the previous Version's state
    async function readState(): Promise<ArtifactState> {
      const lastVersion = versionList.at(-1);
      // Those of its Interview only, for an Artifact attached to one
      const jobList = await readJobList();
      const lastJob = jobList.findLast(
        (job) => job.module === artifact && (job.interview?.id ?? null) === (interview?.id ?? null),
      );
      const isJobLatest =
        lastJob !== undefined && (lastJob.version === null || lastJob.version.number === lastVersion?.number);
      if (!isJobLatest) {
        return ARTIFACT_STATE_SCHEMA.parse({
          state: lastVersion === undefined ? 'absent' : STATE_BY_VERSION_STATE[lastVersion.state],
          failure: null,
          notificationFailure: null,
          workerFailure: null,
        });
      }
      const { state, errorCode, log, notificationErrorCode, notificationFailure } = lastJob;
      // That of this job only: a job overdue says nothing of the one queued behind it
      return ARTIFACT_STATE_SCHEMA.parse({
        state: STATE_BY_JOB_STATE[state],
        failure: state === 'failed' ? { errorCode, log } : null,
        notificationFailure:
          notificationErrorCode === null
            ? null
            : { errorCode: notificationErrorCode, message: notificationFailure ?? '' },
        workerFailure: await findWorkerFailure(lastJob, locale),
      });
    }

    return {
      artifact,
      interview,
      chosenVersion,
      versionList: detailVersionList,
      editRefusal,
      readRun,
      readState,

      // The Inputs of a run started now, each checked as the panel opens: a regeneration as the latest
      // Version read them
      async readInputs() {
        const previousVersion = versionList.at(-1);
        const inputList = await readResolvedInputs();
        return inputList.map((input) => ({
          ...input,
          isChecked: isInitiallyChecked(input, previousVersion),
        }));
      },

      // The folder of one of its Versions, where its module's own reads look
      directoryOf(version: Version): string {
        return workspace.versionDirectoryOf(posting, version);
      },

      // Its entry on the Posting page, the refusal worded for the page: the front keeps its own words for
      // a missing Artifact, beside the button, without the command of the CLI
      async describe() {
        const [state, run] = await Promise.all([readState(), readRun()]);
        return {
          artifact,
          // A queued job has no Version yet, while the worker runs another one (ADR-0003), and a claimed
          // job has none until the worker starts it: the job tells its state
          ...state,
          module: { refusal: run.refusal === null ? null : wordForFront(run.refusal), prompt: run.prompt },
          isEditable: editRefusal === null,
          versionList: detailVersionList.map(({ version, choiceRefusal, documentList }) => ({
            version,
            isChoosable: !version.isChosen && choiceRefusal === null,
            documentList: documentList.map(({ fileName, markdown, saveRefusal }) => ({
              fileName,
              markdown,
              isModifiable: saveRefusal === null,
            })),
          })),
        };
      },

      // Only queues the job: the worker runs it, so restarting the front never stops a session (ADR-0003),
      // with the checked Inputs, refused before queueing; without any, the type's default Inputs
      async queueRun({
        isAutomatic = false,
        inputKeyList = null,
      }: { isAutomatic?: boolean; inputKeyList?: readonly string[] | null } = {}): Promise<Job> {
        refuse(await findRunRefusal(), locale);
        const { checkedList, refusal } = checkInputs(target, await readResolvedInputs(), inputKeyList);
        refuse(refusal, locale);
        return workspace.createJob(posting, artifact, {
          interview,
          isAutomatic,
          inputKeyList: checkedList.map(({ key }) => key),
        });
      },

      async choose(number: number): Promise<void> {
        refuse(choiceRefusalOf(number), locale);
        await workspace.chooseVersion(versionOf(number));
      },

      // A correction by the Candidate changes the Chosen Version in place, without creating another one
      saveDocument(fileName: string, markdown: string): void {
        const fileNameList =
          chosenVersion === undefined
            ? []
            : workspace.readVersionDocuments(posting, chosenVersion).map((document) => document.fileName);
        refuse(saveRefusalOf(chosenVersion, fileName, fileNameList), locale);
        if (chosenVersion !== undefined) {
          workspace.writeVersionDocument(posting, chosenVersion, fileName, markdown);
        }
      },

      // jf edit, on the Chosen Version, its read-only files out of reach of the session
      openForEdition(): void {
        refuse(editRefusal, locale);
        if (chosenVersion === undefined) {
          return;
        }
        const postingDirectory = workspace.postingDirectoryOf(posting);
        const versionPath = path.relative(postingDirectory, workspace.versionDirectoryOf(posting, chosenVersion));
        aiSession.openInteractive({
          prompt: composeEditPrompt({ candidate, posting, artifact, versionPath }),
          directory: postingDirectory,
          readOnlyPathList: READ_ONLY_FILE_NAME_LIST.map((name) => path.join(postingDirectory, '**', name)),
          locale,
        });
      },
    };
  }

  async function candidateOf(posting: Posting): Promise<Candidate> {
    return findCandidate({ candidateId: posting.candidateId });
  }

  return {
    // Checked in the order jf and the front tell them: the Posting, the Artifact (or its module, under jf run,
    // whose unknown name has its own code), then its Interview

    async find(
      name: ({ reference: string } | { posting: Posting }) &
        ({ artifact: string } | { module: string }) & { interview?: number | undefined },
    ) {
      const posting = 'posting' in name ? name.posting : await findPosting(name.reference);
      const candidate = await candidateOf(posting);
      const artifact =
        'artifact' in name
          ? parseArtifactName(name.artifact, candidate.locale, 'unknown_artifact')
          : parseArtifactName(name.module, candidate.locale, 'unknown_module');
      const target = await findTarget(posting, artifact, name.interview, candidate.locale);
      return handleOf(target, artifact, candidate, jobListReaderOf(posting));
    },

    // In the order the Posting page and jf edit list them: the Posting's, then each Interview's, by date
    async listOf(posting: Posting) {
      const candidate = await candidateOf(posting);
      const readJobList = jobListReaderOf(posting);
      const interviewList = await workspace.listInterviews(posting);
      const targetList: ITarget[] = [
        { posting, interview: null },
        ...interviewList.map((interview: Interview) => ({ posting, interview })),
      ];
      return Promise.all(
        targetList.flatMap((target) =>
          ARTIFACT_SCHEMA.options
            .filter((artifact) => isAttachedToInterview(artifact) === (target.interview !== null))
            .map((artifact) => handleOf(target, artifact, candidate, readJobList)),
        ),
      );
    },

    // The worker's only call for an Artifact job. A job queued before its Posting or its Inputs changed is
    // refused before anything is written; a session or output problem comes back as the job's failure.
    async run(
      job: Job & { module: Artifact },
    ): Promise<{ job: Job; version: Version; failure: JobFailure | undefined }> {
      const { posting, interview, module, inputKeyList } = job;
      const candidate = await candidateOf(posting);
      const target = { posting, interview };
      refuse(await findRunRefusalOf(target, module, candidate.locale), candidate.locale);
      // An Input checked at queueing may be gone since, such as an Annex deleted; a job queued before the
      // Inputs were recorded reads the default ones
      const { checkedList, refusal } = checkInputs(
        target,
        await resolveInputs(workspace, target, module),
        inputKeyList,
      );
      refuse(refusal, candidate.locale);
      return runSession({ workspace, aiSession }, job, candidate, checkedList);
    },
  };
}
