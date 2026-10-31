import path from 'node:path';

import type { IAiModule } from '#/ai-module/index.ts';
import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError, type CodedError } from '#/domain/coded-error.ts';
import {
  ARTIFACT_SCHEMA,
  type Artifact,
  type Candidate,
  type Job,
  type Locale,
  type Posting,
  type Version,
} from '#/domain/index.ts';
import { INTERVIEW_BRIEF_MODULE } from '#/modules/interview-brief/index.ts';
import { LETTER_MODULE } from '#/modules/letter/index.ts';
import { RESEARCH_MODULE } from '#/modules/research/index.ts';
import { VISUALIZATION_MODULE } from '#/modules/visualization/index.ts';
import { assertLetterModifiable, findLetterFreeze, hasBeenApplied } from '#/status/index.ts';
import type { Workspace } from '#/workspace/index.ts';

// A Version a job reads, of its own Posting or of another one
interface IReadVersion {
  posting: Posting;
  version: Version;
}

export async function findChosenVersion(workspace: Workspace, posting: Posting, artifact: Artifact) {
  const versionList = await workspace.listVersions(posting, artifact);
  return versionList.find(({ isChosen }) => isChosen);
}

const AI_MODULE_BY_ARTIFACT: Record<Artifact, IAiModule> = {
  research: RESEARCH_MODULE,
  letter: LETTER_MODULE,
  interview_brief: INTERVIEW_BRIEF_MODULE,
  visualization: VISUALIZATION_MODULE,
};

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

// A Repost starts from the work done for the Posting it publishes again
async function findRepostedVersions(workspace: Workspace, { repostOf, candidateId }: Posting) {
  const postingList = repostOf === null ? [] : await workspace.findPostings(repostOf.reference);
  const repostedPosting = postingList.find((posting) => posting.candidateId === candidateId);
  return repostedPosting === undefined ? [] : findChosenVersions(workspace, repostedPosting, ARTIFACT_SCHEMA.options);
}

async function findChosenVersions(
  workspace: Workspace,
  posting: Posting,
  artifactList: readonly Artifact[],
): Promise<IReadVersion[]> {
  const versionList = await Promise.all(
    artifactList.map((artifact) => findChosenVersion(workspace, posting, artifact)),
  );
  return versionList.filter((version) => version !== undefined).map((version) => ({ posting, version }));
}

// Those of the Postings once Applied: what the Candidate sent
async function findSentVersions(workspace: Workspace, { candidateId }: Posting, artifact: Artifact) {
  const postingList = await workspace.listPostings(candidateId);
  const sentList = await Promise.all(
    postingList
      .filter((posting) => hasBeenApplied(posting))
      .map((posting) => findChosenVersions(workspace, posting, [artifact])),
  );
  return sentList.flat();
}

type Refusal = { freeze: string } | { missingArtifact: Artifact };

// Why the module cannot run on the Posting now, undefined when it can: its Artifact frozen since the
// Posting was Applied, or an Artifact it requires without a Chosen Version
async function findRefusal(
  workspace: Workspace,
  posting: Posting,
  module: Artifact,
  locale: Locale,
): Promise<Refusal | undefined> {
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const freeze = aiModule.isFrozenOnceApplied === true ? findLetterFreeze(posting, locale) : undefined;
  if (freeze !== undefined) {
    return { freeze };
  }
  const requiredArtifactList = aiModule.requiredArtifactList ?? [];
  for (const artifact of requiredArtifactList) {
    if ((await findChosenVersion(workspace, posting, artifact)) === undefined) {
      return { missingArtifact: artifact };
    }
  }
  return undefined;
}

// What a refusal for a missing Artifact names
function missingArtifactValues(missingArtifact: Artifact, posting: Posting, module: Artifact, locale: Locale) {
  const tCommon = tFor(locale, 'common');
  return {
    reference: posting.reference,
    missingArtifact,
    missingLabel: tCommon(`artifactLabelByArtifact.${missingArtifact}`),
    moduleLabel: tCommon(`artifactLabelByArtifact.${module}`),
  };
}

// The refusal in the words of the front, beside the button of the missing Artifact
function wordRefusal(refusal: Refusal, posting: Posting, module: Artifact, locale: Locale): string {
  return 'freeze' in refusal
    ? refusal.freeze
    : tFor(locale, 'error')(
        'missingArtifactForFront',
        missingArtifactValues(refusal.missingArtifact, posting, module, locale),
      );
}

// The refusal as the error of an action, in the words of the CLI, with the command that lifts it
function refusalError(refusal: Refusal, posting: Posting, module: Artifact, locale: Locale) {
  return 'freeze' in refusal
    ? codedError('letter_frozen', { reference: posting.reference }, { locale })
    : codedError('missing_artifact', missingArtifactValues(refusal.missingArtifact, posting, module, locale), {
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
export async function findInputs(workspace: Workspace, posting: Posting, module: Artifact, locale: Locale) {
  const refusal = await findRefusal(workspace, posting, module, locale);
  if (refusal !== undefined) {
    throw refusalError(refusal, posting, module, locale);
  }
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const artifactList = [...(aiModule.requiredArtifactList ?? []), ...(aiModule.optionalArtifactList ?? [])];
  const versionList = [
    ...(await findChosenVersions(workspace, posting, artifactList)),
    ...(aiModule.isReadingRepostedPosting === true ? await findRepostedVersions(workspace, posting) : []),
    ...(aiModule.isReadingSentVersions === true ? await findSentVersions(workspace, posting, module) : []),
  ];
  const directoryList = aiModule.isReadingProfile === true ? [workspace.profileDirectoryOf(posting.candidateId)] : [];
  return { versionList, directoryList };
}

// The Posting page offers a module with the very checks of a launch
export async function describeModule(workspace: Workspace, posting: Posting, artifact: Artifact, locale: Locale) {
  const refusal = await findRefusal(workspace, posting, artifact, locale);
  return { refusal: refusal === undefined ? null : wordRefusal(refusal, posting, artifact, locale) };
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
    const formatError = findFormatError?.(content, locale, posting);
    return formatError === undefined
      ? undefined
      : codedError('malformed_output', { outputPath, formatError }, { locale });
  }

  return async function runJob(
    job: Job & { module: Artifact },
    locale: Locale,
  ): Promise<{ job: Job; version: Version; failure: JobFailure | undefined }> {
    const { posting, module } = job;
    const aiModule = AI_MODULE_BY_ARTIFACT[module];
    const { versionList: inputList, directoryList } = await findInputs(workspace, posting, module, locale);
    const candidateInstructions = workspace.readInstructions(posting.candidateId, module);
    const candidate = await findCandidate({ candidateId: posting.candidateId });
    const instructions = candidateInstructions ?? findDefaultInstructions(module, candidate);
    const hasCandidateInstructions = candidateInstructions !== null;
    const version = await workspace.startJob(job, { instructions, hasCandidateInstructions, inputList });
    const postingDirectory = workspace.postingDirectoryOf(posting);
    const outputDirectory = workspace.createVersionDirectory(posting, version);
    const readVersionList = inputList.map((input) => {
      const directory = workspace.versionDirectoryOf(input.posting, input.version);
      const { fileName } = AI_MODULE_BY_ARTIFACT[input.version.artifact];
      return {
        reference: input.posting.reference,
        artifact: input.version.artifact,
        directory,
        filePath: path.join(directory, fileName),
      };
    });
    const fixedPrompt = aiModule.composePrompt({
      posting,
      outputDirectory: path.relative(postingDirectory, outputDirectory),
      readVersionList,
      profileDirectory: workspace.profileDirectoryOf(posting.candidateId),
    });
    const session = await aiSession.runHeadless({
      fixedPrompt,
      instructions,
      directory: postingDirectory,
      // The session runs in the folder of the Posting: only the folders outside it are added
      readDirectoryList: [
        ...directoryList,
        ...readVersionList
          .map(({ directory }) => directory)
          .filter((directory) => path.relative(postingDirectory, directory).startsWith('..')),
      ],
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
