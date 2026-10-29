import type { Artefact, Offre } from '#/domain/index.ts';

// What the fixed part of a prompt names: the folder of the Version, relative to the folder of the
// Offre where the session runs, and the absolute folders of what it reads
export interface IPromptInput {
  offre: Offre;
  outputDirectory: string;
  readVersionList: { reference: string; artefact: Artefact; directory: string }[];
  profilDirectory: string;
}

interface IOutputFile {
  name: string;
  // What makes the file malformed, if anything
  findFormatError?: (content: string, offre: Offre) => string | undefined;
}

// What an AI module gives the job runner, from the single entry point of its folder; the runner
// reads its inputs and its refusals from these declarations (ADR-0003)
export interface IAiModule {
  // A shorter name than its Artefact, for jf run
  alias?: string;
  // The file of the Version the Candidat reads
  fileName: string;
  // The files the session writes in the folder of the Version
  outputFileList: IOutputFile[];
  defaultConsignes: string;
  composePrompt(input: IPromptInput): string;
  // Runs once the files are valid, before the Version is ready
  completeVersion?(versionDirectory: string): void;
  // The Artefacts of the Offre the module reads: it refuses to run until each has a Version retenue
  requiredArtefactList?: readonly Artefact[];
  // The Artefacts of the Offre the module also reads, when they have a Version retenue
  optionalArtefactList?: readonly Artefact[];
  // Whether the module reads the Profil of the Candidat
  isReadingProfil?: boolean;
  // Whether it reads the Artefacts retenus of the Offre that a Republication publishes again
  isReadingRepublishedOffre?: boolean;
  // Whether it reads its own Artefact retenu of each Offre once Postulée: what the Candidat sent
  isReadingSentVersions?: boolean;
  // Whether its Version retenue is what the Candidat sends: frozen once the Offre is Postulée
  isFrozenOncePostulee?: boolean;
}
