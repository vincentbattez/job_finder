import path from 'node:path';

import type { IAiModule, IReadVersion as IPromptReadVersion } from '#/ai-module/index.ts';
import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { codedError, type CodedError } from '#/domain/coded-error.ts';
import { type Artifact, type Candidate, type Job, type Locale, type Posting, type Version } from '#/domain/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import type { IInput, ITarget } from './inputs.ts';
import { composeMessage, leaveUnmarked, markSubstitution, promptOf } from './prompt.ts';
import { AI_MODULE_BY_ARTIFACT, findDefaultInstructions, isAttachedToInterview } from './registry.ts';

// Why a job failed, which the notification of an automatic job tells: an Error Code and its message
export type JobFailure = Pick<CodedError, 'code' | 'message'>;

// What a module's session receives, shared by the run and the preview so the preview never drifts; the
// Fixed Part waits for the folder of the Version, which the run creates after reading the inputs (ADR-0003).
// A module whose Inputs are inlined receives them in its message (ADR-0021); the others still name the
// files of the Versions they read, and read the Profile folder
function composeSession(
  workspace: Workspace,
  { posting, interview }: ITarget,
  module: Artifact,
  candidate: Candidate,
  checkedList: IInput[],
) {
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const isInliningInputs = aiModule.isInliningInputs === true;
  const inputList = checkedList.flatMap(({ readVersion }) => (readVersion === null ? [] : [readVersion]));
  const directoryList = aiModule.isReadingProfile === true ? [workspace.profileDirectoryOf(posting.candidateId)] : [];
  const candidateInstructions = workspace.readInstructions(posting.candidateId, module);
  const instructions = candidateInstructions ?? findDefaultInstructions(module, candidate);
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
    instructions,
    hasCandidateInstructions: candidateInstructions !== null,
    postingDirectory,
    message: isInliningInputs ? composeMessage(posting, checkedList, instructions) : instructions,
    // The session runs in the folder of the Posting: only the folders outside it are added
    readDirectoryList: isInliningInputs
      ? []
      : [
          ...directoryList,
          ...readVersionList
            .map(({ directory }) => directory)
            .filter((directory) => path.relative(postingDirectory, directory).startsWith('..')),
        ],
    composeFixedPart: (outputDirectory: string, mark = leaveUnmarked): string =>
      aiModule.composePrompt({
        posting,
        interview,
        notes: aiModule.isReadingNotes === true ? posting.notes : null,
        outputDirectory: path.relative(postingDirectory, outputDirectory),
        readVersionList,
        profileDirectory: workspace.profileDirectoryOf(posting.candidateId),
        mark,
      }),
  };
}

// The number of the Version still to be created, which the preview cannot know before the run
const NEXT_VERSION_PLACEHOLDER = '<next>';

// The Prompt a run started now would receive, with the Versions it reads; its Fixed Part also comes with
// the values the composer substituted marked, for the panel to highlight
export function previewPrompt(
  workspace: Workspace,
  target: ITarget,
  module: Artifact,
  candidate: Candidate,
  checkedList: IInput[],
) {
  const session = composeSession(workspace, target, module, candidate, checkedList);
  const outputDirectory = workspace.versionDirectoryOf(target.posting, {
    interview: isAttachedToInterview(module) ? target.interview : null,
    artifact: module,
    number: NEXT_VERSION_PLACEHOLDER,
  });
  const fixedPart = session.composeFixedPart(outputDirectory);
  return {
    fixedPart,
    markedFixedPart: session.composeFixedPart(outputDirectory, markSubstitution),
    instructions: session.instructions,
    prompt: promptOf({ fixedPrompt: fixedPart, message: session.message }),
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

// The run of a job whose refusal and checked Inputs were checked; the Version keeps the Instructions it was made with, so
// that two Versions compare
export async function runSession(
  { workspace, aiSession }: { workspace: Workspace; aiSession: IAiSession },
  job: Job & { module: Artifact },
  candidate: Candidate,
  checkedList: IInput[],
): Promise<{ job: Job; version: Version; failure: JobFailure | undefined }> {
  const { posting, interview, module } = job;
  const { locale } = candidate;
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const { instructions, hasCandidateInstructions, postingDirectory, message, readDirectoryList, composeFixedPart } =
    composeSession(workspace, { posting, interview }, module, candidate, checkedList);
  // The Version records the Inputs its run read, each read Version linked
  const version = await workspace.startJob(job, {
    instructions,
    hasCandidateInstructions,
    inputList: checkedList.map(({ key, readVersion }) => ({ key, version: readVersion?.version ?? null })),
  });
  const outputDirectory = workspace.createVersionDirectory(posting, version);
  const session = await aiSession.runHeadless({
    fixedPrompt: composeFixedPart(outputDirectory),
    message,
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
