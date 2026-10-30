import path from 'node:path';

import type { IAiModule } from '#/ai-module/index.ts';
import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { ARTEFACT_SCHEMA, type Artefact, type Job, type Posting, type Version } from '#/domain/index.ts';
import { ARTEFACT_LABEL_BY_ARTEFACT } from '#/domain/labels.ts';
import { FICHE_ENTRETIEN_MODULE } from '#/modules/fiche-entretien/index.ts';
import { LETTRE_MODULE } from '#/modules/lettre/index.ts';
import { RECHERCHE_MODULE } from '#/modules/recherche/index.ts';
import { VISUALISATION_MODULE } from '#/modules/visualisation/index.ts';
import { assertLettreModifiable, findLettreFreeze, hasBeenApplied } from '#/status/index.ts';
import type { Workspace } from '#/workspace/index.ts';

// A Version a job reads, of its own Posting or of another one
interface IReadVersion {
  posting: Posting;
  version: Version;
}

export async function findVersionRetenue(workspace: Workspace, posting: Posting, artefact: Artefact) {
  const versionList = await workspace.listVersions(posting, artefact);
  return versionList.find(({ isRetenue }) => isRetenue);
}

const AI_MODULE_BY_ARTEFACT: Record<Artefact, IAiModule> = {
  recherche: RECHERCHE_MODULE,
  lettre: LETTRE_MODULE,
  fiche_entretien: FICHE_ENTRETIEN_MODULE,
  visualisation: VISUALISATION_MODULE,
};

// An Artefact, or the module that produces it, named after it or by the module's alias
function parseArtefactName(name: string, noun: 'Artefact' | 'Module'): Artefact {
  const artefact = ARTEFACT_SCHEMA.options.find(
    (option) => name === option || name === AI_MODULE_BY_ARTEFACT[option].alias,
  );
  if (artefact === undefined) {
    const nameList = Object.entries(AI_MODULE_BY_ARTEFACT).map(([option, aiModule]) => aiModule.alias ?? option);
    throw new Error(`${noun} inconnu : ${name}. ${noun}s : ${nameList.join(', ')}.`);
  }
  return artefact;
}

export function parseModule(name: string): Artefact {
  return parseArtefactName(name, 'Module');
}

export function parseArtefact(name: string): Artefact {
  return parseArtefactName(name, 'Artefact');
}

export function findDefaultInstructions(module: Artefact): string {
  return AI_MODULE_BY_ARTEFACT[module].defaultInstructions;
}

// A Repost starts from the work done for the Posting it publishes again
async function findRepostedVersions(workspace: Workspace, { repostOf, candidateId }: Posting) {
  const postingList = repostOf === null ? [] : await workspace.findPostings(repostOf.reference);
  const repostedPosting = postingList.find((posting) => posting.candidateId === candidateId);
  return repostedPosting === undefined ? [] : findVersionsRetenues(workspace, repostedPosting, ARTEFACT_SCHEMA.options);
}

async function findVersionsRetenues(
  workspace: Workspace,
  posting: Posting,
  artefactList: readonly Artefact[],
): Promise<IReadVersion[]> {
  const versionList = await Promise.all(
    artefactList.map((artefact) => findVersionRetenue(workspace, posting, artefact)),
  );
  return versionList.filter((version) => version !== undefined).map((version) => ({ posting, version }));
}

// Those of the Postings once Applied: what the Candidate sent
async function findSentVersions(workspace: Workspace, { candidateId }: Posting, artefact: Artefact) {
  const postingList = await workspace.listPostings(candidateId);
  const sentList = await Promise.all(
    postingList
      .filter((posting) => hasBeenApplied(posting))
      .map((posting) => findVersionsRetenues(workspace, posting, [artefact])),
  );
  return sentList.flat();
}

type Refusal = { freeze: string } | { missingArtefact: Artefact };

// Why the module cannot run on the Posting now, undefined when it can: its Artefact frozen since the
// Posting was Applied, or an Artefact it requires without a Version retenue
async function findRefusal(workspace: Workspace, posting: Posting, module: Artefact): Promise<Refusal | undefined> {
  const aiModule = AI_MODULE_BY_ARTEFACT[module];
  const freeze = aiModule.isFrozenOnceApplied === true ? findLettreFreeze(posting) : undefined;
  if (freeze !== undefined) {
    return { freeze };
  }
  const requiredArtefactList = aiModule.requiredArtefactList ?? [];
  for (const artefact of requiredArtefactList) {
    if ((await findVersionRetenue(workspace, posting, artefact)) === undefined) {
      return { missingArtefact: artefact };
    }
  }
  return undefined;
}

// The refusal in the words of the CLI, with the command that lifts it, or of the front, beside the
// button of the missing Artefact
function wordRefusal(refusal: Refusal, posting: Posting, module: Artefact, isForFront = false): string {
  if ('freeze' in refusal) {
    return refusal.freeze;
  }
  const { missingArtefact } = refusal;
  const missingLabel = ARTEFACT_LABEL_BY_ARTEFACT[missingArtefact];
  const reason = `L'Offre ${posting.reference} n'a pas de ${missingLabel} retenue, sur laquelle s'appuie la ${ARTEFACT_LABEL_BY_ARTEFACT[module]}`;
  return isForFront
    ? `${reason} : lancez d'abord la ${missingLabel}.`
    : `${reason}. La produire d'abord : jf run ${missingArtefact} ${posting.reference}.`;
}

// What the Candidate sends, the Lettre, is frozen once the Posting was Applied
export function assertNotFrozen(posting: Posting, artefact: Artefact): void {
  if (AI_MODULE_BY_ARTEFACT[artefact].isFrozenOnceApplied === true) {
    assertLettreModifiable(posting);
  }
}

// Throws before anything is written: the actions refuse a job up front, the runner a job queued
// before the Posting changed
export async function findInputs(workspace: Workspace, posting: Posting, module: Artefact) {
  const refusal = await findRefusal(workspace, posting, module);
  if (refusal !== undefined) {
    throw new Error(wordRefusal(refusal, posting, module));
  }
  const aiModule = AI_MODULE_BY_ARTEFACT[module];
  const artefactList = [...(aiModule.requiredArtefactList ?? []), ...(aiModule.optionalArtefactList ?? [])];
  const versionList = [
    ...(await findVersionsRetenues(workspace, posting, artefactList)),
    ...(aiModule.isReadingRepostedPosting === true ? await findRepostedVersions(workspace, posting) : []),
    ...(aiModule.isReadingSentVersions === true ? await findSentVersions(workspace, posting, module) : []),
  ];
  const directoryList = aiModule.isReadingProfile === true ? [workspace.profileDirectoryOf(posting.candidateId)] : [];
  return { versionList, directoryList };
}

// The fiche offers a module with the very checks of a launch
export async function describeModule(workspace: Workspace, posting: Posting, artefact: Artefact) {
  const refusal = await findRefusal(workspace, posting, artefact);
  return { refusal: refusal === undefined ? null : wordRefusal(refusal, posting, artefact, true) };
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

  return async function runJob(job: Job & { module: Artefact }): Promise<{ job: Job; version: Version }> {
    const { posting, module } = job;
    const aiModule = AI_MODULE_BY_ARTEFACT[module];
    const { versionList: inputList, directoryList } = await findInputs(workspace, posting, module);
    const candidateInstructions = workspace.readInstructions(posting.candidateId, module);
    const instructions = candidateInstructions ?? aiModule.defaultInstructions;
    const hasCandidateInstructions = candidateInstructions !== null;
    const version = await workspace.startJob(job, { instructions, hasCandidateInstructions, inputList });
    const postingDirectory = workspace.postingDirectoryOf(posting);
    const outputDirectory = workspace.createVersionDirectory(posting, version);
    const readVersionList = inputList.map((input) => {
      const directory = workspace.versionDirectoryOf(input.posting, input.version);
      const { fileName } = AI_MODULE_BY_ARTEFACT[input.version.artefact];
      return {
        reference: input.posting.reference,
        artefact: input.version.artefact,
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
