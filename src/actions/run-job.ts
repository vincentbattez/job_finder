import path from 'node:path';

import type { IAiModule, IReadVersion as IPromptReadVersion } from '#/ai-module/index.ts';
import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError, type CodedError } from '#/domain/coded-error.ts';
import {
  ARTIFACT_SCHEMA,
  type Artifact,
  type Candidate,
  type Interview,
  type Job,
  type Locale,
  type Posting,
  type Version,
} from '#/domain/index.ts';
import { INTERVIEW_BRIEF_MODULE } from '#/modules/interview-brief/index.ts';
import { LETTER_MODULE } from '#/modules/letter/index.ts';
import { PORTRAIT_MODULE } from '#/modules/portrait/index.ts';
import { RESEARCH_MODULE } from '#/modules/research/index.ts';
import { VISUALIZATION_MODULE } from '#/modules/visualization/index.ts';
import { assertLetterModifiable, findLetterFreeze, hasBeenApplied } from '#/status/index.ts';
import type { Workspace } from '#/workspace/index.ts';

// A Version a job reads, of its own Posting or of another one
interface IReadVersion {
  posting: Posting;
  version: Version;
}

// Where a module runs: its Posting, and the Interview it prepares for a module attached to one, else null
export interface ITarget {
  posting: Posting;
  interview: Interview | null;
}

const AI_MODULE_BY_ARTIFACT: Record<Artifact, IAiModule> = {
  research: RESEARCH_MODULE,
  letter: LETTER_MODULE,
  portrait: PORTRAIT_MODULE,
  interview_brief: INTERVIEW_BRIEF_MODULE,
  visualization: VISUALIZATION_MODULE,
};

// Whether its Versions are attached to an Interview rather than to the Posting, as its module declares
function isAttachedToInterview(artifact: Artifact): boolean {
  return AI_MODULE_BY_ARTIFACT[artifact].isAttachedToInterview === true;
}

// The Artifacts attached where the target points: on its Interview, or on its Posting without one
export function listTargetArtifacts({ interview }: ITarget): Artifact[] {
  return ARTIFACT_SCHEMA.options.filter((artifact) => isAttachedToInterview(artifact) === (interview !== null));
}

// The Chosen Version of an Artifact where it is attached: on the Interview of the target, or on its Posting
export async function findChosenVersion(workspace: Workspace, { posting, interview }: ITarget, artifact: Artifact) {
  const versionList = await workspace.listVersions(
    posting,
    artifact,
    isAttachedToInterview(artifact) ? interview : null,
  );
  return versionList.find(({ isChosen }) => isChosen);
}

// The jf command that names an Artifact, its arguments in order: the number of its Interview comes last,
// for an Artifact attached to one
export function commandOf(argumentList: string[], interview: Pick<Interview, 'number'> | null): string {
  return ['jf', ...argumentList, ...(interview === null ? [] : [String(interview.number)])].join(' ');
}

// The Interview an Artifact is handled on: one is named for an Artifact attached to an Interview, none
// for one attached to the Posting
export async function findTarget(
  workspace: Workspace,
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

// An Artifact, or the module that produces it, named after it or by the module's alias
function parseArtifactName(name: string, locale: Locale, errorCode: 'unknown_module' | 'unknown_artifact'): Artifact {
  const artifact = ARTIFACT_SCHEMA.options.find(
    (option) => name === option || name === AI_MODULE_BY_ARTIFACT[option].alias,
  );
  if (artifact === undefined) {
    const nameList = Object.entries(AI_MODULE_BY_ARTIFACT).map(([option, aiModule]) => aiModule.alias ?? option);
    throw codedError(errorCode, { name, names: nameList.join(', ') }, { locale });
  }
  return artifact;
}

export function parseModule(name: string, locale: Locale): Artifact {
  return parseArtifactName(name, locale, 'unknown_module');
}

export function parseArtifact(name: string, locale: Locale): Artifact {
  return parseArtifactName(name, locale, 'unknown_artifact');
}

// Those of the Candidate's locale, the ones they read and edit; the Artifact's language is set by the
// fixed part of the prompt
export function findDefaultInstructions(module: Artifact, candidate: Candidate): string {
  return tFor(candidate.locale, 'defaultInstructions')(module);
}

async function findChosenVersions(
  workspace: Workspace,
  target: ITarget,
  artifactList: readonly Artifact[],
): Promise<IReadVersion[]> {
  const versionList = await Promise.all(artifactList.map((artifact) => findChosenVersion(workspace, target, artifact)));
  return versionList
    .filter((version) => version !== undefined)
    .map((version) => ({ posting: target.posting, version }));
}

// A Repost starts from the work done for the Posting it publishes again
async function findRepostedVersions(workspace: Workspace, { repostOf, candidateId }: Posting) {
  const postingList = repostOf === null ? [] : await workspace.findPostings(repostOf.reference);
  const repostedPosting = postingList.find((posting) => posting.candidateId === candidateId);
  return repostedPosting === undefined
    ? []
    : findChosenVersions(
        workspace,
        { posting: repostedPosting, interview: null },
        ARTIFACT_SCHEMA.options.filter((artifact) => !isAttachedToInterview(artifact)),
      );
}

// Those of the Postings once Applied: what the Candidate sent
async function findSentVersions(workspace: Workspace, { candidateId }: Posting, artifact: Artifact) {
  const postingList = await workspace.listPostings(candidateId);
  const sentList = await Promise.all(
    postingList
      .filter((posting) => hasBeenApplied(posting))
      .map((posting) => findChosenVersions(workspace, { posting, interview: null }, [artifact])),
  );
  return sentList.flat();
}

// The Interviews before the one a module runs for, by date as the Posting lists them
async function listPreviousInterviews(workspace: Workspace, { posting, interview }: ITarget) {
  if (interview === null) {
    return [];
  }
  const interviewList = await workspace.listInterviews(posting);
  return interviewList.slice(
    0,
    interviewList.findIndex(({ id }) => id === interview.id),
  );
}

type Refusal = { freeze: string } | { missingArtifact: Artifact };

// Why the module cannot run on its target now, undefined when it can: its Artifact frozen since the
// Posting was Applied, or an Artifact it requires without a Chosen Version
async function findRefusal(
  workspace: Workspace,
  target: ITarget,
  module: Artifact,
  locale: Locale,
): Promise<Refusal | undefined> {
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const freeze = aiModule.isFrozenOnceApplied === true ? findLetterFreeze(target.posting, locale) : undefined;
  if (freeze !== undefined) {
    return { freeze };
  }
  const requiredArtifactList = aiModule.requiredArtifactList ?? [];
  for (const artifact of requiredArtifactList) {
    if ((await findChosenVersion(workspace, target, artifact)) === undefined) {
      return { missingArtifact: artifact };
    }
  }
  return undefined;
}

// What a refusal for a missing Artifact names, with the command that produces it where it is attached
function missingArtifactValues(
  missingArtifact: Artifact,
  { posting, interview }: ITarget,
  module: Artifact,
  locale: Locale,
) {
  const tCommon = tFor(locale, 'common');
  const { reference } = posting;
  return {
    reference,
    missingLabel: tCommon(`artifactLabelByArtifact.${missingArtifact}`),
    moduleLabel: tCommon(`artifactLabelByArtifact.${module}`),
    command: commandOf(['run', missingArtifact, reference], isAttachedToInterview(missingArtifact) ? interview : null),
  };
}

// The refusal in the words of the front, beside the button of the missing Artifact
function wordRefusal(refusal: Refusal, target: ITarget, module: Artifact, locale: Locale): string {
  return 'freeze' in refusal
    ? refusal.freeze
    : tFor(locale, 'error')(
        'missingArtifactForFront',
        missingArtifactValues(refusal.missingArtifact, target, module, locale),
      );
}

// The refusal as the error of an action, in the words of the CLI, with the command that lifts it
function refusalError(refusal: Refusal, target: ITarget, module: Artifact, locale: Locale) {
  return 'freeze' in refusal
    ? codedError('letter_frozen', { reference: target.posting.reference }, { locale })
    : codedError('missing_artifact', missingArtifactValues(refusal.missingArtifact, target, module, locale), {
        locale,
      });
}

// What the Candidate sends, the Letter, is frozen once the Posting was Applied
export function assertNotFrozen(posting: Posting, artifact: Artifact, locale: Locale): void {
  if (AI_MODULE_BY_ARTIFACT[artifact].isFrozenOnceApplied === true) {
    assertLetterModifiable(posting, locale);
  }
}

// Throws before anything is written: the actions refuse a job up front, the runner a job queued
// before the Posting changed
export async function findInputs(workspace: Workspace, target: ITarget, module: Artifact, locale: Locale) {
  const refusal = await findRefusal(workspace, target, module, locale);
  if (refusal !== undefined) {
    throw refusalError(refusal, target, module, locale);
  }
  const { posting } = target;
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const artifactList = [...(aiModule.requiredArtifactList ?? []), ...(aiModule.optionalArtifactList ?? [])];
  const previousInterviewList = await listPreviousInterviews(workspace, target);
  const previousList = await Promise.all(
    previousInterviewList.map((interview) =>
      findChosenVersions(workspace, { posting, interview }, aiModule.previousInterviewArtifactList ?? []),
    ),
  );
  const versionList = [
    ...(await findChosenVersions(workspace, target, artifactList)),
    ...previousList.flat(),
    ...(aiModule.isReadingRepostedPosting === true ? await findRepostedVersions(workspace, posting) : []),
    ...(aiModule.isReadingSentVersions === true ? await findSentVersions(workspace, posting, module) : []),
  ];
  const directoryList = aiModule.isReadingProfile === true ? [workspace.profileDirectoryOf(posting.candidateId)] : [];
  return { versionList, directoryList };
}

// What a module's session receives, shared by the runner and the preview so the preview never drifts; the
// Fixed Part waits for the folder of the Version, which the runner creates after reading the inputs (ADR-0003)
async function composeSession(
  workspace: Workspace,
  target: ITarget,
  module: Artifact,
  candidate: Candidate,
  locale: Locale,
) {
  const { posting, interview } = target;
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const { versionList: inputList, directoryList } = await findInputs(workspace, target, module, locale);
  const candidateInstructions = workspace.readInstructions(posting.candidateId, module);
  const postingDirectory = workspace.postingDirectoryOf(posting);
  const readVersionList = inputList.map((input): IPromptReadVersion => {
    const directory = workspace.versionDirectoryOf(input.posting, input.version);
    const { fileName } = AI_MODULE_BY_ARTIFACT[input.version.artifact];
    return {
      reference: input.posting.reference,
      artifact: input.version.artifact,
      interviewNumber: input.version.interview?.number ?? null,
      directory,
      filePath: path.join(directory, fileName),
    };
  });
  return {
    inputList,
    instructions: candidateInstructions ?? findDefaultInstructions(module, candidate),
    hasCandidateInstructions: candidateInstructions !== null,
    postingDirectory,
    // The session runs in the folder of the Posting: only the folders outside it are added
    readDirectoryList: [
      ...directoryList,
      ...readVersionList
        .map(({ directory }) => directory)
        .filter((directory) => path.relative(postingDirectory, directory).startsWith('..')),
    ],
    composeFixedPart: (outputDirectory: string): string =>
      aiModule.composePrompt({
        posting,
        interview,
        notes: aiModule.isReadingNotes === true ? posting.notes : null,
        outputDirectory: path.relative(postingDirectory, outputDirectory),
        readVersionList,
        profileDirectory: workspace.profileDirectoryOf(posting.candidateId),
      }),
  };
}

// The number of the Version still to be created, which the preview cannot know before the run
const NEXT_VERSION_PLACEHOLDER = '<next>';

// The Prompt a run started now would receive, with the Versions it reads; none for a refused module
async function previewPrompt(
  workspace: Workspace,
  target: ITarget,
  module: Artifact,
  candidate: Candidate,
  locale: Locale,
) {
  const session = await composeSession(workspace, target, module, candidate, locale);
  const outputDirectory = workspace.versionDirectoryOf(target.posting, {
    interview: isAttachedToInterview(module) ? target.interview : null,
    artifact: module,
    number: NEXT_VERSION_PLACEHOLDER,
  });
  return {
    fixedPart: session.composeFixedPart(outputDirectory),
    instructions: session.instructions,
    readVersionList: session.inputList.map(({ posting, version }) => ({
      reference: posting.reference,
      artifact: version.artifact,
      interviewNumber: version.interview?.number ?? null,
      number: version.number,
    })),
  };
}

// The Posting page offers a module with the very checks of a launch, and shows the Prompt it would run
export async function describeModule(
  workspace: Workspace,
  target: ITarget,
  artifact: Artifact,
  candidate: Candidate,
  locale: Locale,
) {
  const refusal = await findRefusal(workspace, target, artifact, locale);
  return refusal === undefined
    ? { refusal: null, prompt: await previewPrompt(workspace, target, artifact, candidate, locale) }
    : { refusal: wordRefusal(refusal, target, artifact, locale), prompt: null };
}

// Why a job failed, which the notification of an automatic job tells: an Error Code and its message
export type JobFailure = Pick<CodedError, 'code' | 'message'>;

// The worker runs each queued job with it (ADR-0003); the Version keeps the Instructions it was made
// with, so that two Versions compare
export function createJobRunner(
  workspace: Workspace,
  aiSession: IAiSession,
  findCandidate: (rawInput: unknown) => Promise<Candidate>,
) {
  // A Version is ready only once each of its files exists, is not empty and has the module's format
  function findOutputProblem(
    { name, findFormatError }: IAiModule['outputFileList'][number],
    posting: Posting,
    outputDirectory: string,
    locale: Locale,
  ) {
    const filePath = path.join(outputDirectory, name);
    const outputPath = path.relative(workspace.postingDirectoryOf(posting), filePath);
    const content = workspace.readTextFile(filePath);
    if (content === null) {
      return codedError('missing_output', { outputPath }, { locale });
    }
    if (content.trim() === '') {
      return codedError('empty_output', { outputPath }, { locale });
    }
    const formatProblem = findFormatError?.(content, locale, posting);
    return formatProblem === undefined
      ? undefined
      : codedError('malformed_output', { outputPath, formatError: formatProblem }, { locale });
  }

  return async function runJob(
    job: Job & { module: Artifact },
    locale: Locale,
  ): Promise<{ job: Job; version: Version; failure: JobFailure | undefined }> {
    const { posting, interview, module } = job;
    const aiModule = AI_MODULE_BY_ARTIFACT[module];
    const candidate = await findCandidate({ candidateId: posting.candidateId });
    const { inputList, instructions, hasCandidateInstructions, postingDirectory, readDirectoryList, composeFixedPart } =
      await composeSession(workspace, { posting, interview }, module, candidate, locale);
    const version = await workspace.startJob(job, { instructions, hasCandidateInstructions, inputList });
    const outputDirectory = workspace.createVersionDirectory(posting, version);
    const session = await aiSession.runHeadless({
      fixedPrompt: composeFixedPart(outputDirectory),
      instructions,
      directory: postingDirectory,
      readDirectoryList,
      outputDirectory,
      locale,
    });
    // The log starts with the message of the failure's code, which the Posting page and jf versions show;
    // that of a failure the session names already does
    if (session.errorCode !== null) {
      const { errorCode, log, sessionId } = session;
      const finished = await workspace.finishJob({ job, version }, { errorCode, log, sessionId });
      return { ...finished, failure: { code: errorCode, message: log } };
    }
    const problem = session.isSuccess
      ? aiModule.outputFileList
          .map((outputFile) => findOutputProblem(outputFile, posting, outputDirectory, locale))
          .find((fileProblem) => fileProblem !== undefined)
      : codedError('session_failed', {}, { locale });
    const errorCode = problem?.code ?? null;
    if (errorCode === null) {
      aiModule.completeVersion?.(outputDirectory);
    }
    const finished = await workspace.finishJob(
      { job, version },
      {
        errorCode,
        log: problem === undefined ? session.log : `${problem.message}\n${session.log}`,
        sessionId: session.sessionId,
      },
    );
    return { ...finished, failure: problem };
  };
}
