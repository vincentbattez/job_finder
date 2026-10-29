import { mkdirSync } from 'node:fs';
import path from 'node:path';

import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import {
  ARTEFACT_SCHEMA,
  MODULE_RUN_SCHEMA,
  type Artefact,
  type Job,
  type ModuleRun,
  type Offre,
  type Version,
} from '#/domain/index.ts';
import { LETTRE_MODULE } from '#/modules/lettre/index.ts';
import { RECHERCHE_MODULE } from '#/modules/recherche/index.ts';
import { assertLettreModifiable } from '#/statut/index.ts';
import type { Workspace } from '#/workspace/index.ts';

interface IReadVersion {
  offre: Offre;
  version: Version;
}

async function findVersionRetenue(workspace: Workspace, offre: Offre, artefact: Artefact) {
  const versionList = await workspace.listVersions(offre, artefact);
  return versionList.find(({ isRetenue }) => isRetenue);
}

interface IOutputFile {
  name: string;
  // What makes the file malformed, if anything
  findFormatError?: (content: string, offre: Offre) => string | undefined;
}

// What the fixed part of a prompt names: the folder of the Version, relative to the folder of the
// Offre where the session runs, and the absolute folders of what it reads
interface IPromptInput {
  offre: Offre;
  outputDirectory: string;
  readVersionList: { reference: string; artefact: Artefact; directory: string }[];
  profilDirectory: string;
}

// What an AI module gives the job runner, from the single entry point of its folder (ADR-0003)
interface IAiModule {
  // The file of the Version the Candidat reads, returned once the job has run
  fileName: string;
  // The files the session writes in the folder of the Version
  outputFileList: IOutputFile[];
  defaultConsignes: string;
  composePrompt(input: IPromptInput): string;
  // Runs once the files are valid, before the Version is ready
  completeVersion?(versionDirectory: string): void;
}

const AI_MODULE_BY_ARTEFACT: Partial<Record<Artefact, IAiModule>> = {
  recherche: RECHERCHE_MODULE,
  lettre: LETTRE_MODULE,
};

// The modules available so far, each named after the Artefact it produces
export function parseModule(name: string): Artefact {
  const artefact = ARTEFACT_SCHEMA.safeParse(name);
  if (!artefact.success || AI_MODULE_BY_ARTEFACT[artefact.data] === undefined) {
    throw new Error(`Module inconnu : ${name}. Modules : ${Object.keys(AI_MODULE_BY_ARTEFACT).join(', ')}.`);
  }
  return artefact.data;
}

// The default Consignes of each module available, in the order of the Artefacts: a module added
// to AI_MODULE_BY_ARTEFACT shows up in the front and the CLI by itself
export function listDefaultConsignes(): { module: Artefact; defaultConsignes: string }[] {
  return ARTEFACT_SCHEMA.options.flatMap((module) => {
    const aiModule = AI_MODULE_BY_ARTEFACT[module];
    return aiModule === undefined ? [] : { module, defaultConsignes: aiModule.defaultConsignes };
  });
}

// A Republication starts from the work done for the Offre it publishes again: the Version retenue
// of each of its Artefacts (spec « Republication »)
async function findRepublishedVersions(workspace: Workspace, { republicationOf, candidatId }: Offre) {
  const offreList = republicationOf === null ? [] : await workspace.findOffres(republicationOf.reference);
  const republishedOffre = offreList.find((candidate) => candidate.candidatId === candidatId);
  if (republishedOffre === undefined) {
    return [];
  }
  const versionList = await Promise.all(
    ARTEFACT_SCHEMA.options.map((artefact) => findVersionRetenue(workspace, republishedOffre, artefact)),
  );
  return versionList
    .filter((version) => version !== undefined)
    .map((version): IReadVersion => ({ offre: republishedOffre, version }));
}

// What a job reads besides the Fiche de poste of its Offre: Versions, and folders outside the
// Offre. The Recherche of a Republication reads the Artefacts of the Offre it publishes again. The
// Lettre reads the Recherche retenue, the Profil, and the Brouillon/Lettre pairs the Candidat sent,
// those of the Lettre retenue of each Postulée Offre (spec « Modules IA »). Throws, before anything
// is written, when the module cannot run on the Offre: a Lettre frozen by Postulée, or no Recherche
// retenue. The actions call it to refuse a job up front, the runner again for a job queued before
// the Offre changed.
export async function findInputs(workspace: Workspace, offre: Offre, module: Artefact) {
  if (module === 'recherche') {
    return { versionList: await findRepublishedVersions(workspace, offre), directoryList: [] };
  }
  if (module !== 'lettre') {
    return { versionList: [], directoryList: [] };
  }
  assertLettreModifiable(offre);
  const recherche = await findVersionRetenue(workspace, offre, 'recherche');
  if (recherche === undefined) {
    throw new Error(
      `L'Offre ${offre.reference} n'a pas de Recherche retenue, sur laquelle s'appuie la Lettre. La produire d'abord : jf run recherche ${offre.reference}.`,
    );
  }
  const offreList = await workspace.listOffres(offre.candidatId);
  const sentList: IReadVersion[] = [];
  for (const sentOffre of offreList) {
    const lettre =
      sentOffre.status === 'postulee' ? await findVersionRetenue(workspace, sentOffre, 'lettre') : undefined;
    if (lettre !== undefined) {
      sentList.push({ offre: sentOffre, version: lettre });
    }
  }
  return {
    versionList: [{ offre, version: recherche }, ...sentList],
    directoryList: [workspace.profilDirectoryOf(offre.candidatId)],
  };
}

// The one function that runs a job: the worker calls it on each queued job (ADR-0003). The
// session gets the fixed part of the module's prompt and the Candidat's Consignes, or the default
// ones; the Version keeps them.
export function createJobRunner(workspace: Workspace, aiSession: IAiSession) {
  // A Version is ready only once each of its files exists, is not empty and has the module's format
  function findOutputProblem({ name, findFormatError }: IOutputFile, offre: Offre, outputDirectory: string) {
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

  return async function runJob(job: Job): Promise<ModuleRun> {
    const { offre, module } = job;
    const aiModule = AI_MODULE_BY_ARTEFACT[module];
    if (aiModule === undefined) {
      throw new Error(`Module pas encore disponible : ${module}.`);
    }
    const { versionList: inputList, directoryList } = await findInputs(workspace, offre, module);
    const candidatConsignes = workspace.readConsignes(offre.candidatId, module);
    const consignes = candidatConsignes ?? aiModule.defaultConsignes;
    const hasCandidatConsignes = candidatConsignes !== null;
    const version = await workspace.startJob(job, { consignes, hasCandidatConsignes, inputList });
    const offreDirectory = workspace.offreDirectoryOf(offre);
    const outputDirectory = workspace.versionDirectoryOf(offre, version);
    mkdirSync(outputDirectory, { recursive: true });
    const readVersionList = inputList.map((input) => ({
      reference: input.offre.reference,
      artefact: input.version.artefact,
      directory: workspace.versionDirectoryOf(input.offre, input.version),
    }));
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
      readDirectoryList: [...directoryList, ...readVersionList.map(({ directory }) => directory)],
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
    const finished = await workspace.finishJob(
      { job, version },
      {
        isReady,
        log: problem === undefined ? session.log : `${problem}\n${session.log}`,
        sessionId: session.sessionId,
      },
    );
    return MODULE_RUN_SCHEMA.parse({ ...finished, filePath: path.join(outputDirectory, aiModule.fileName) });
  };
}
