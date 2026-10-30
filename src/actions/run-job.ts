import path from 'node:path';

import type { IAiModule } from '#/ai-module/index.ts';
import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { ARTIFACT_SCHEMA, type Artifact, type Job, type Posting, type Version } from '#/domain/index.ts';
import { ARTIFACT_LABEL_BY_ARTIFACT } from '#/domain/labels.ts';
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
function parseArtifactName(name: string, noun: 'Artefact' | 'Module'): Artifact {
  const artifact = ARTIFACT_SCHEMA.options.find(
    (option) => name === option || name === AI_MODULE_BY_ARTIFACT[option].alias,
  );
  if (artifact === undefined) {
    const nameList = Object.entries(AI_MODULE_BY_ARTIFACT).map(([option, aiModule]) => aiModule.alias ?? option);
    throw new Error(`${noun} inconnu : ${name}. ${noun}s : ${nameList.join(', ')}.`);
  }
  return artifact;
}

export function parseModule(name: string): Artifact {
  return parseArtifactName(name, 'Module');
}

export function parseArtifact(name: string): Artifact {
  return parseArtifactName(name, 'Artefact');
}

export function findDefaultInstructions(module: Artifact): string {
  return AI_MODULE_BY_ARTIFACT[module].defaultInstructions;
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
async function findRefusal(workspace: Workspace, posting: Posting, module: Artifact): Promise<Refusal | undefined> {
  const aiModule = AI_MODULE_BY_ARTIFACT[module];
  const freeze = aiModule.isFrozenOnceApplied === true ? findLetterFreeze(posting) : undefined;
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

// The refusal in the words of the CLI, with the command that lifts it, or of the front, beside the
// button of the missing Artifact
function wordRefusal(refusal: Refusal, posting: Posting, module: Artifact, isForFront = false): string {
  if ('freeze' in refusal) {
    return refusal.freeze;
  }
  const { missingArtifact } = refusal;
  const missingLabel = ARTIFACT_LABEL_BY_ARTIFACT[missingArtifact];
  const reason = `L'Offre ${posting.reference} n'a pas de ${missingLabel} retenue, sur laquelle s'appuie la ${ARTIFACT_LABEL_BY_ARTIFACT[module]}`;
  return isForFront
    ? `${reason} : lancez d'abord la ${missingLabel}.`
    : `${reason}. La produire d'abord : jf run ${missingArtifact} ${posting.reference}.`;
}

// What the Candidate sends, the Letter, is frozen once the Posting was Applied
export function assertNotFrozen(posting: Posting, artifact: Artifact): void {
  if (AI_MODULE_BY_ARTIFACT[artifact].isFrozenOnceApplied === true) {
    assertLetterModifiable(posting);
  }
}

// Throws before anything is written: the actions refuse a job up front, the runner a job queued
// before the Posting changed
export async function findInputs(workspace: Workspace, posting: Posting, module: Artifact) {
  const refusal = await findRefusal(workspace, posting, module);
  if (refusal !== undefined) {
    throw new Error(wordRefusal(refusal, posting, module));
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
export async function describeModule(workspace: Workspace, posting: Posting, artifact: Artifact) {
  const refusal = await findRefusal(workspace, posting, artifact);
  return { refusal: refusal === undefined ? null : wordRefusal(refusal, posting, artifact, true) };
}

// The worker runs each queued job with it (ADR-0003); the Version keeps the Instructions it was made
// with, so that two Versions compare
export function createJobRunner(workspace: Workspace, aiSession: IAiSession) {
  // A Version is ready only once each of its files exists, is not empty and has the module's format
  function findOutputProblem(
    { name, findFormatError }: IAiModule['outputFileList'][number],
    posting: Posting,
    outputDirectory: string,
  ) {
    const filePath = path.join(outputDirectory, name);
    const outputPath = path.relative(workspace.postingDirectoryOf(posting), filePath);
    const content = workspace.readTextFile(filePath);
    if (content === null) {
      return `Le fichier attendu ${outputPath} est absent.`;
    }
    if (content.trim() === '') {
      return `Le fichier attendu ${outputPath} est vide.`;
    }
    const formatError = findFormatError?.(content, posting);
    return formatError === undefined ? undefined : `Le fichier ${outputPath} est mal formé : ${formatError}.`;
  }

  return async function runJob(job: Job & { module: Artifact }): Promise<{ job: Job; version: Version }> {
    const { posting, module } = job;
    const aiModule = AI_MODULE_BY_ARTIFACT[module];
    const { versionList: inputList, directoryList } = await findInputs(workspace, posting, module);
    const candidateInstructions = workspace.readInstructions(posting.candidateId, module);
    const instructions = candidateInstructions ?? aiModule.defaultInstructions;
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
    });
    const problem = session.isSuccess
      ? aiModule.outputFileList
          .map((outputFile) => findOutputProblem(outputFile, posting, outputDirectory))
          .find((fileProblem) => fileProblem !== undefined)
      : undefined;
    const isReady = session.isSuccess && problem === undefined;
    if (isReady) {
      aiModule.completeVersion?.(outputDirectory);
    }
    return workspace.finishJob(
      { job, version },
      {
        isReady,
        log: problem === undefined ? session.log : `${problem}\n${session.log}`,
        sessionId: session.sessionId,
      },
    );
  };
}
