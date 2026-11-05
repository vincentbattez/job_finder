import type { Actions, Artifact, ErrorCode } from '#/actions/index.ts';
import type { State } from '#/actions/state.ts';

// The Versions of an Artifact as readPosting gives them, shared by the views of its tabs
type VersionState = 'running' | 'ready' | 'failed';

export type Validation = 'draft' | 'validated';

// What the generation panel shows before a run: each Input with its exact content, the refusal, the Prompt
// of the checked Inputs (spec #125, « Inputs and the generation panel »)
export type Generation = Awaited<ReturnType<Actions['readGeneration']>>;
export type GenerationInput = Generation['inputList'][number];

// A Version with its text, null while it runs or once it failed, and the AI's Original, null for a Version
// the Candidate brought (ADR-0019)
export interface IVersionDetail {
  version: {
    number: number;
    state: VersionState;
    validation: Validation;
    origin: 'ai' | 'candidate';
    isChosen: boolean;
    hasCandidateInstructions: boolean;
    instructions: string;
    createdAt: Date;
  };
  // Given by the action: a Draft to validate, or an older Validated Version to choose again
  isValidatable: boolean;
  isCorrectable: boolean;
  text: string | null;
  original: string | null;
}

export interface IArtifactVersions {
  artifact: Artifact;
  state: State;
  // Why its last job failed: the code and the log, which starts with the code's message
  failure: { errorCode: ErrorCode | null; log: string } | null;
  // Why the notification of its last job, such as « Research ready », was not sent
  notificationFailure: { errorCode: ErrorCode; message: string } | null;
  // Why its last job, queued or running, does not move: the worker is stopped or stuck
  workerFailure: { errorCode: ErrorCode; message: string } | null;
  // The module that produces the Artifact, and why it cannot run now
  module: { refusal: string | null };
  // Given by the action: jf edit opens its Chosen Version
  isEditable: boolean;
  // The file of a Version the Candidate reads and corrects, and how its text is written (ADR-0020)
  fileName: string;
  format: 'mdx' | 'markdown';
  // The Letter of an Applied Posting, read-only
  isFrozen: boolean;
  versionList: IVersionDetail[];
}

// What an Artifact tab, a list row or the Sheet tells of it at a glance (spec #125, « IArtifact »): its
// latest ready Version's validation, none before any
export function summaryOf({ versionList }: Pick<IArtifactVersions, 'versionList'>): Validation | 'none' {
  return versionList.findLast(({ version }) => version.state === 'ready')?.version.validation ?? 'none';
}

// Where the Letter stands before marking Applied: its latest Version still a Draft, and its Chosen Version,
// the one recorded as sent
export interface ILetterStanding {
  draftNumber: number | null;
  chosenNumber: number | null;
}

export function letterStandingOf(letter: Pick<IArtifactVersions, 'versionList'> | undefined): ILetterStanding {
  const versionList = letter?.versionList ?? [];
  const latest = versionList.findLast(({ version }) => version.state === 'ready');
  return {
    draftNumber: latest?.version.validation === 'draft' && latest.isValidatable ? latest.version.number : null,
    chosenNumber: versionList.find(({ version }) => version.isChosen)?.version.number ?? null,
  };
}
