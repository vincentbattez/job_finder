import path from 'node:path';

import type { IAiModule } from '#/ai-module/index.ts';
import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { codedError, type CodedError } from '#/domain/coded-error.ts';
import { type Artifact, type Candidate, type Job, type Locale, type Posting, type Version } from '#/domain/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import type { IInput, ITarget } from './inputs.ts';
import { composeMessage, leaveUnmarked, markSubstitution, promptOf } from './prompt.ts';
import { AI_MODULE_BY_ARTIFACT, findDefaultInstructions, isAttachedToInterview } from './registry.ts';

// Why a job failed, which the notification of an automatic job tells: an Error Code and its message
export type JobFailure = Pick<CodedError, 'code' | 'message'>;

// What a module's session receives, shared by the run and the preview so the preview never drifts: its
// checked Inputs inlined in its message (ADR-0021). The Fixed Part waits for the folder of the Version, which
// the run creates after reading the inputs (ADR-0003).
function composeSession(
  workspace: Workspace,
  { posting, interview }: ITarget,
  module: Artifact,
  candidate: Candidate,
  checkedList: IInput[],
) {
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const inputList = checkedList.flatMap(({ readVersion }) => (readVersion === null ? [] : [readVersion]));
  const candidateInstructions = workspace.readInstructions(posting.candidateId, module);
  const instructions = candidateInstructions ?? findDefaultInstructions(module, candidate);
  const postingDirectory = workspace.postingDirectoryOf(posting);
  return {
    inputList,
    instructions,
    hasCandidateInstructions: candidateInstructions !== null,
    postingDirectory,
    message: composeMessage(posting, checkedList, instructions),
    composeFixedPart: (outputDirectory: string, mark = leaveUnmarked): string =>
      aiModule.composePrompt({
        posting,
        interview,
        outputDirectory: path.relative(postingDirectory, outputDirectory),
        readVersionList: inputList.map(({ posting: readPosting, version }) => ({
          reference: readPosting.reference,
          artifact: version.artifact,
          interviewNumber: version.interview?.number ?? null,
        })),
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
  const { instructions, hasCandidateInstructions, postingDirectory, message, composeFixedPart } = composeSession(
    workspace,
    { posting, interview },
    module,
    candidate,
    checkedList,
  );
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
    outputDirectory,
    isReadingDirectory: false,
    isSearchingWeb: aiModule.isSearchingWeb === true,
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
  // The AI's text stays as it wrote it, beside the text the Candidate corrects (ADR-0019)
  if (errorCode === null) {
    workspace.keepOriginal(posting, version, aiModule.fileName);
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
