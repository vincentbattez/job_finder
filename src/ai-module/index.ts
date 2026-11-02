import type { Artifact, Interview, Locale, Posting } from '#/domain/index.ts';

// An Artifact is written for the employer: in the language of the Job Description, whatever the
// Candidate's locale and the language of their Instructions (spec #65). Each fixed part states it.
export function describeArtifactLanguage(artifactName: string): string {
  return `Write the ${artifactName} in the language of the Job Description, whatever the language of this prompt and of the Candidate's Instructions.`;
}

// The headings of the message that follows the Fixed Part, its Inputs inlined (ADR-0021); each Input's own
// starts with its prefix, which the headings inside its content do not
export const INPUTS_HEADING = 'Inputs';
export const INPUT_HEADING_PREFIX = 'Input: ';
export const INSTRUCTIONS_HEADING = 'Instructions';

// What a Fixed Part says of the message that follows it, its Inputs inlined: the session reads nothing from disk
export function describeMessage(): string {
  return `The next message holds everything you read, under \`# ${INPUTS_HEADING}\`: each Input under its own heading, \`## ${INPUT_HEADING_PREFIX}…\`, with its full content. Look for no other file to read. Then come the Candidate's Instructions, under \`# ${INSTRUCTIONS_HEADING}\`.`;
}

// A Chosen Version the module reads: of its Posting, of its Interview or of a previous one (interviewNumber),
// or of another Posting
interface IReadVersion {
  reference: string;
  artifact: Artifact;
  // The number of the Interview the Version is attached to, null for a Version of the Posting
  interviewNumber: number | null;
}

// The output folder is relative to the Posting's folder, where the session runs; what it reads comes
// inlined in its message (ADR-0021)
export interface IPromptInput {
  posting: Posting;
  // The Interview it prepares, for a module attached to one; null otherwise
  interview: Interview | null;
  outputDirectory: string;
  // The Chosen Versions among its checked Inputs
  readVersionList: IReadVersion[];
  // Wraps each value the composer substitutes, where it puts it, so that the preview highlights it; the
  // run's leaves it as is (spec #125)
  mark: (value: string) => string;
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
  // MDX through the closed catalogue, or plain Markdown for the Letter (ADR-0020)
  format: 'mdx' | 'markdown';
  // The files the session writes in the folder of the Version
  outputFileList: IOutputFile[];
  composePrompt(input: IPromptInput): string;
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
  // Whether its session searches the web; it reads nothing from disk either way, its Inputs inlined (ADR-0021)
  isSearchingWeb?: boolean;
  // Whether it reads the Notes of the Posting
  isReadingNotes?: boolean;
  // Whether the module reads the Profile of the Candidate, its Past Letters included: those of the Profile
  // and the Chosen Letters of the other Postings once Applied, what the Candidate sent
  isReadingProfile?: boolean;
  // Whether it reads each Letter sent with its Original, the text the AI wrote: the Candidate's corrections
  // show their style and what they reject
  isReadingOriginals?: boolean;
  // Whether it reads the Chosen Artifacts of the Posting that a Repost publishes again
  isReadingRepostedPosting?: boolean;
  // Whether its Chosen Version is what the Candidate sends: frozen once the Posting is Applied
  isFrozenOnceApplied?: boolean;
}
