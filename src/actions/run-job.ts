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
} from '#/domain/index.ts';
import { RECHERCHE_MODULE } from '#/modules/recherche/index.ts';
import type { Workspace } from '#/workspace/index.ts';

// What an AI module gives the job runner, from the single entry point of its folder (ADR-0003)
interface IAiModule {
  outputFileName: string;
  defaultConsignes: string;
  composePrompt(offre: Offre, outputPath: string): string;
  // What makes the file malformed, if anything
  findFormatError(content: string): string | undefined;
}

const AI_MODULE_BY_ARTEFACT: Partial<Record<Artefact, IAiModule>> = { recherche: RECHERCHE_MODULE };

// The modules available so far, each named after the Artefact it produces
export function parseModule(name: string): Artefact {
  const artefact = ARTEFACT_SCHEMA.safeParse(name);
  if (!artefact.success || AI_MODULE_BY_ARTEFACT[artefact.data] === undefined) {
    throw new Error(`Module inconnu : ${name}. Modules : ${Object.keys(AI_MODULE_BY_ARTEFACT).join(', ')}.`);
  }
  return artefact.data;
}

// A Version is ready only once its file exists, is not empty and has the module's format
function findOutputProblem(aiModule: IAiModule, outputPath: string, content: string | null): string | undefined {
  if (content === null) {
    return `Le fichier attendu ${outputPath} est absent.`;
  }
  if (content.trim() === '') {
    return `Le fichier attendu ${outputPath} est vide.`;
  }
  const formatError = aiModule.findFormatError(content);
  return formatError === undefined ? undefined : `Le fichier ${outputPath} est mal formé : ${formatError}.`;
}

// The one function that runs a job: the worker calls it on each queued job (ADR-0003). The
// session gets the fixed part of the module's prompt and the Candidat's Consignes, or the default
// ones; the Version keeps them.
export function createJobRunner(workspace: Workspace, aiSession: IAiSession) {
  return async function runJob(job: Job): Promise<ModuleRun> {
    const { offre, module } = job;
    const aiModule = AI_MODULE_BY_ARTEFACT[module];
    if (aiModule === undefined) {
      throw new Error(`Module pas encore disponible : ${module}.`);
    }
    const consignes = workspace.readConsignes(offre.candidatId, module) ?? aiModule.defaultConsignes;
    const version = await workspace.startJob(job, consignes);
    const offreDirectory = workspace.offreDirectoryOf(offre);
    const outputDirectory = workspace.versionDirectoryOf(offre, version);
    mkdirSync(outputDirectory, { recursive: true });
    const filePath = path.join(outputDirectory, aiModule.outputFileName);
    const outputPath = path.relative(offreDirectory, filePath);
    const session = await aiSession.runHeadless({
      fixedPrompt: aiModule.composePrompt(offre, outputPath),
      consignes,
      directory: offreDirectory,
      outputDirectory,
    });
    const problem = session.isSuccess
      ? findOutputProblem(aiModule, outputPath, workspace.readTextFile(filePath))
      : undefined;
    const finished = await workspace.finishJob(
      { job, version },
      {
        isReady: session.isSuccess && problem === undefined,
        log: problem === undefined ? session.log : `${problem}\n${session.log}`,
        sessionId: session.sessionId,
      },
    );
    return MODULE_RUN_SCHEMA.parse({ ...finished, filePath });
  };
}
