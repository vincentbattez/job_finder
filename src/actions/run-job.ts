import path from 'node:path';

import type { IAiModule } from '#/ai-module/index.ts';
import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { ARTEFACT_SCHEMA, type Artefact, type Job, type Offre, type Version } from '#/domain/index.ts';
import { ARTEFACT_LABEL_BY_ARTEFACT } from '#/domain/labels.ts';
import { FICHE_ENTRETIEN_MODULE } from '#/modules/fiche-entretien/index.ts';
import { LETTRE_MODULE } from '#/modules/lettre/index.ts';
import { RECHERCHE_MODULE } from '#/modules/recherche/index.ts';
import { VISUALISATION_MODULE } from '#/modules/visualisation/index.ts';
import { assertLettreModifiable, findLettreFreeze, hasBeenPostulee } from '#/statut/index.ts';
import type { Workspace } from '#/workspace/index.ts';

// A Version a job reads, of its own Offre or of another one
interface IReadVersion {
  offre: Offre;
  version: Version;
}

export async function findVersionRetenue(workspace: Workspace, offre: Offre, artefact: Artefact) {
  const versionList = await workspace.listVersions(offre, artefact);
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
    (candidate) => name === candidate || name === AI_MODULE_BY_ARTEFACT[candidate].alias,
  );
  if (artefact === undefined) {
    const nameList = Object.entries(AI_MODULE_BY_ARTEFACT).map(([candidate, aiModule]) => aiModule.alias ?? candidate);
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

export function findDefaultConsignes(module: Artefact): string {
  return AI_MODULE_BY_ARTEFACT[module].defaultConsignes;
}

// A Republication starts from the work done for the Offre it publishes again
async function findRepublishedVersions(workspace: Workspace, { republicationOf, candidatId }: Offre) {
  const offreList = republicationOf === null ? [] : await workspace.findOffres(republicationOf.reference);
  const republishedOffre = offreList.find((candidate) => candidate.candidatId === candidatId);
  return republishedOffre === undefined
    ? []
    : findVersionsRetenues(workspace, republishedOffre, ARTEFACT_SCHEMA.options);
}

async function findVersionsRetenues(
  workspace: Workspace,
  offre: Offre,
  artefactList: readonly Artefact[],
): Promise<IReadVersion[]> {
  const versionList = await Promise.all(artefactList.map((artefact) => findVersionRetenue(workspace, offre, artefact)));
  return versionList.filter((version) => version !== undefined).map((version) => ({ offre, version }));
}

// Those of the Offres once Postulée: what the Candidat sent
async function findSentVersions(workspace: Workspace, { candidatId }: Offre, artefact: Artefact) {
  const offreList = await workspace.listOffres(candidatId);
  const sentList = await Promise.all(
    offreList
      .filter((offre) => hasBeenPostulee(offre))
      .map((offre) => findVersionsRetenues(workspace, offre, [artefact])),
  );
  return sentList.flat();
}

type Refusal = { freeze: string } | { missingArtefact: Artefact };

// Why the module cannot run on the Offre now, undefined when it can: its Artefact frozen since the
// Offre was Postulée, or an Artefact it requires without a Version retenue
async function findRefusal(workspace: Workspace, offre: Offre, module: Artefact): Promise<Refusal | undefined> {
  const aiModule = AI_MODULE_BY_ARTEFACT[module];
  const freeze = aiModule.isFrozenOncePostulee === true ? findLettreFreeze(offre) : undefined;
  if (freeze !== undefined) {
    return { freeze };
  }
  const requiredArtefactList = aiModule.requiredArtefactList ?? [];
  for (const artefact of requiredArtefactList) {
    if ((await findVersionRetenue(workspace, offre, artefact)) === undefined) {
      return { missingArtefact: artefact };
    }
  }
  return undefined;
}

// The refusal in the words of the CLI, with the command that lifts it, or of the front, beside the
// button of the missing Artefact
function wordRefusal(refusal: Refusal, offre: Offre, module: Artefact, isForFront = false): string {
  if ('freeze' in refusal) {
    return refusal.freeze;
  }
  const { missingArtefact } = refusal;
  const missingLabel = ARTEFACT_LABEL_BY_ARTEFACT[missingArtefact];
  const reason = `L'Offre ${offre.reference} n'a pas de ${missingLabel} retenue, sur laquelle s'appuie la ${ARTEFACT_LABEL_BY_ARTEFACT[module]}`;
  return isForFront
    ? `${reason} : lancez d'abord la ${missingLabel}.`
    : `${reason}. La produire d'abord : jf run ${missingArtefact} ${offre.reference}.`;
}

// What the Candidat sends, the Lettre, is frozen once the Offre was Postulée
export function assertNotFrozen(offre: Offre, artefact: Artefact): void {
  if (AI_MODULE_BY_ARTEFACT[artefact].isFrozenOncePostulee === true) {
    assertLettreModifiable(offre);
  }
}

// Throws before anything is written: the actions refuse a job up front, the runner a job queued
// before the Offre changed
export async function findInputs(workspace: Workspace, offre: Offre, module: Artefact) {
  const refusal = await findRefusal(workspace, offre, module);
  if (refusal !== undefined) {
    throw new Error(wordRefusal(refusal, offre, module));
  }
  const aiModule = AI_MODULE_BY_ARTEFACT[module];
  const artefactList = [...(aiModule.requiredArtefactList ?? []), ...(aiModule.optionalArtefactList ?? [])];
  const versionList = [
    ...(await findVersionsRetenues(workspace, offre, artefactList)),
    ...(aiModule.isReadingRepublishedOffre === true ? await findRepublishedVersions(workspace, offre) : []),
    ...(aiModule.isReadingSentVersions === true ? await findSentVersions(workspace, offre, module) : []),
  ];
  const directoryList = aiModule.isReadingProfil === true ? [workspace.profilDirectoryOf(offre.candidatId)] : [];
  return { versionList, directoryList };
}

// The fiche offers a module with the very checks of a launch
export async function describeModule(workspace: Workspace, offre: Offre, artefact: Artefact) {
  const refusal = await findRefusal(workspace, offre, artefact);
  return { refusal: refusal === undefined ? null : wordRefusal(refusal, offre, artefact, true) };
}

// The worker runs each queued job with it (ADR-0003); the Version keeps the Consignes it was made
// with, so that two Versions compare
export function createJobRunner(workspace: Workspace, aiSession: IAiSession) {
  // A Version is ready only once each of its files exists, is not empty and has the module's format
  function findOutputProblem(
    { name, findFormatError }: IAiModule['outputFileList'][number],
    offre: Offre,
    outputDirectory: string,
  ) {
    const filePath = path.join(outputDirectory, name);
    const outputPath = path.relative(workspace.offreDirectoryOf(offre), filePath);
    const content = workspace.readTextFile(filePath);
    if (content === null) {
      return `Le fichier attendu ${outputPath} est absent.`;
    }
    if (content.trim() === '') {
      return `Le fichier attendu ${outputPath} est vide.`;
    }
    const formatError = findFormatError?.(content, offre);
    return formatError === undefined ? undefined : `Le fichier ${outputPath} est mal formé : ${formatError}.`;
  }

  return async function runJob(job: Job & { module: Artefact }): Promise<{ job: Job; version: Version }> {
    const { offre, module } = job;
    const aiModule = AI_MODULE_BY_ARTEFACT[module];
    const { versionList: inputList, directoryList } = await findInputs(workspace, offre, module);
    const candidatConsignes = workspace.readConsignes(offre.candidatId, module);
    const consignes = candidatConsignes ?? aiModule.defaultConsignes;
    const hasCandidatConsignes = candidatConsignes !== null;
    const version = await workspace.startJob(job, { consignes, hasCandidatConsignes, inputList });
    const offreDirectory = workspace.offreDirectoryOf(offre);
    const outputDirectory = workspace.createVersionDirectory(offre, version);
    const readVersionList = inputList.map((input) => {
      const directory = workspace.versionDirectoryOf(input.offre, input.version);
      const { fileName } = AI_MODULE_BY_ARTEFACT[input.version.artefact];
      return {
        reference: input.offre.reference,
        artefact: input.version.artefact,
        directory,
        filePath: path.join(directory, fileName),
      };
    });
    const fixedPrompt = aiModule.composePrompt({
      offre,
      outputDirectory: path.relative(offreDirectory, outputDirectory),
      readVersionList,
      profilDirectory: workspace.profilDirectoryOf(offre.candidatId),
    });
    const session = await aiSession.runHeadless({
      fixedPrompt,
      consignes,
      directory: offreDirectory,
      // The session runs in the folder of the Offre: only the folders outside it are added
      readDirectoryList: [
        ...directoryList,
        ...readVersionList
          .map(({ directory }) => directory)
          .filter((directory) => path.relative(offreDirectory, directory).startsWith('..')),
      ],
      outputDirectory,
    });
    const problem = session.isSuccess
      ? aiModule.outputFileList
          .map((outputFile) => findOutputProblem(outputFile, offre, outputDirectory))
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
