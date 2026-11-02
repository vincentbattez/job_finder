import type { ErrorCode } from '#/domain/error.ts';
import { JOB_DESCRIPTION_FILE_NAME, type Artifact, type Interview, type Locale, type Posting } from '#/domain/index.ts';

// An Artifact is written for the employer: in the language of the Job Description, whatever the
// Candidate's locale and the language of their Instructions (spec #65). Each fixed part states it.
export function describeArtifactLanguage(artifactName: string): string {
  return `Write the ${artifactName} in the language of the Job Description, \`${JOB_DESCRIPTION_FILE_NAME}\`, whatever the language of this prompt and of the Candidate's Instructions.`;
}

// A Chosen Version the module reads: of its Posting, of its Interview or of a previous one (interviewNumber),
// or of another Posting
export interface IReadVersion {
  reference: string;
  artifact: Artifact;
  // The number of the Interview the Version is attached to, null for a Version of the Posting
  interviewNumber: number | null;
  directory: string;
  filePath: string;
}

// The output folder is relative to the Posting's folder, where the session runs; what it reads is
// named by absolute paths
export interface IPromptInput {
  posting: Posting;
  // The Interview it prepares, for a module attached to one; null otherwise
  interview: Interview | null;
  // The Notes of the Posting, for a module that reads them; null otherwise
  notes: string | null;
  outputDirectory: string;
  readVersionList: IReadVersion[];
  profileDirectory: string;
}

interface IOutputFile {
  name: string;
  // What makes the file malformed, if anything, told in the Candidate's locale
  findFormatError?: (content: string, locale: Locale, posting: Posting) => string | undefined;
}

// What an AI module gives the Artifact module, from the single entry point of its folder, which reads
// its inputs and its refusals from these declarations (ADR-0003, ADR-0016)
export interface IAiModule {
  // A shorter name than its Artifact, for jf run
  alias?: string;
  // The file of the Version the Candidate reads
  fileName: string;
  // The files the session writes in the folder of the Version
  outputFileList: IOutputFile[];
  composePrompt(input: IPromptInput): string;
  // Runs once the files are valid, before the Version is ready
  completeVersion?(versionDirectory: string): void;
  // Whether its Versions are attached to an Interview, numbered and chosen per Interview, rather than
  // to the Posting: it then runs for a given Interview
  isAttachedToInterview?: boolean;
  // The Artifacts the module reads: it refuses to run until each has a Chosen Version. Each is looked up
  // where it is attached: on the Posting (Research, Letter) or on the Interview the module runs for.
  requiredArtifactList?: readonly Artifact[];
  // The Artifacts the module also reads, when they have a Chosen Version, looked up the same way
  optionalArtifactList?: readonly Artifact[];
  // The Artifacts whose Chosen Version it reads on each Interview of the Posting before its own
  previousInterviewArtifactList?: readonly Artifact[];
  // Whether it reads the Notes of the Posting
  isReadingNotes?: boolean;
  // Whether the module reads the Profile of the Candidate, its Past Letters included: those of the Profile
  // and the Chosen Letters of the other Postings once Applied, what the Candidate sent
  isReadingProfile?: boolean;
  // Whether it reads the Chosen Artifacts of the Posting that a Repost publishes again
  isReadingRepostedPosting?: boolean;
  // Whether its Chosen Version is what the Candidate sends: frozen once the Posting is Applied
  isFrozenOnceApplied?: boolean;
  // The files of a Version kept as the AI wrote them, each with the code that refuses to modify it; jf
  // edit keeps them out of reach of its session too
  readOnlyFileList?: readonly { name: string; errorCode: ErrorCode }[];
}
