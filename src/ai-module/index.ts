import type { Artifact, Posting } from '#/domain/index.ts';

// The output folder is relative to the Posting's folder, where the session runs; what it reads is
// named by absolute paths
export interface IPromptInput {
  posting: Posting;
  outputDirectory: string;
  readVersionList: { reference: string; artifact: Artifact; directory: string; filePath: string }[];
  profileDirectory: string;
}

interface IOutputFile {
  name: string;
  // What makes the file malformed, if anything
  findFormatError?: (content: string, posting: Posting) => string | undefined;
}

// What an AI module gives the job runner, from the single entry point of its folder; the runner
// reads its inputs and its refusals from these declarations (ADR-0003)
export interface IAiModule {
  // A shorter name than its Artifact, for jf run
  alias?: string;
  // The file of the Version the Candidate reads
  fileName: string;
  // The files the session writes in the folder of the Version
  outputFileList: IOutputFile[];
  defaultInstructions: string;
  composePrompt(input: IPromptInput): string;
  // Runs once the files are valid, before the Version is ready
  completeVersion?(versionDirectory: string): void;
  // The Artifacts of the Posting the module reads: it refuses to run until each has a Chosen Version
  requiredArtifactList?: readonly Artifact[];
  // The Artifacts of the Posting the module also reads, when they have a Chosen Version
  optionalArtifactList?: readonly Artifact[];
  // Whether the module reads the Profile of the Candidate
  isReadingProfile?: boolean;
  // Whether it reads the Chosen Artifacts of the Posting that a Repost publishes again
  isReadingRepostedPosting?: boolean;
  // Whether it reads its own Chosen Artifact of each Posting once Applied: what the Candidate sent
  isReadingSentVersions?: boolean;
  // Whether its Chosen Version is what the Candidate sends: frozen once the Posting is Applied
  isFrozenOnceApplied?: boolean;
}
