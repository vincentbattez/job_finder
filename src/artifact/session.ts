import path from 'node:path';

import type { IAiModule, IReadVersion as IPromptReadVersion } from '#/ai-module/index.ts';
import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
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
import { hasBeenApplied } from '#/status/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import { AI_MODULE_BY_ARTIFACT, findDefaultInstructions, isAttachedToInterview } from './registry.ts';

// Where an Artifact is attached: its Posting, and the Interview it prepares for an Artifact attached to
// one, else null
export interface ITarget {
  posting: Posting;
  interview: Interview | null;
}

// A Version a run reads, of its own Posting or of another one
interface IReadVersion {
  posting: Posting;
  version: Version;
}

// Why a job failed, which the notification of an automatic job tells: an Error Code and its message
export type JobFailure = Pick<CodedError, 'code' | 'message'>;

// The Chosen Version of an Artifact where it is attached: on the Interview of the target, or on its Posting
export async function findChosenVersion(workspace: Workspace, { posting, interview }: ITarget, artifact: Artifact) {
  const versionList = await workspace.listVersions(
    posting,
    artifact,
    isAttachedToInterview(artifact) ? interview : null,
  );
  return versionList.find(({ isChosen }) => isChosen);
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

// What a run reads, once its refusal is checked
async function findInputs(workspace: Workspace, target: ITarget, aiModule: IAiModule, module: Artifact) {
  const { posting } = target;
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

// What a module's session receives, shared by the run and the preview so the preview never drifts; the
// Fixed Part waits for the folder of the Version, which the run creates after reading the inputs (ADR-0003)
async function composeSession(workspace: Workspace, target: ITarget, module: Artifact, candidate: Candidate) {
  const { posting, interview } = target;
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const { versionList: inputList, directoryList } = await findInputs(workspace, target, aiModule, module);
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

// The Prompt a run started now would receive, with the Versions it reads
export async function previewPrompt(workspace: Workspace, target: ITarget, module: Artifact, candidate: Candidate) {
  const session = await composeSession(workspace, target, module, candidate);
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

// A Version is ready only once each of its files exists, is not empty and has the module's format
function findOutputProblem(
  workspace: Workspace,
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

// The run of a job whose refusal was checked; the Version keeps the Instructions it was made with, so
// that two Versions compare
export async function runSession(
  { workspace, aiSession }: { workspace: Workspace; aiSession: IAiSession },
  job: Job & { module: Artifact },
  candidate: Candidate,
): Promise<{ job: Job; version: Version; failure: JobFailure | undefined }> {
  const { posting, interview, module } = job;
  const { locale } = candidate;
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const { inputList, instructions, hasCandidateInstructions, postingDirectory, readDirectoryList, composeFixedPart } =
    await composeSession(workspace, { posting, interview }, module, candidate);
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
        .map((outputFile) => findOutputProblem(workspace, outputFile, posting, outputDirectory, locale))
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
}
