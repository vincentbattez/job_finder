import type { Artifact, ErrorCode } from '#/actions/index.ts';

import type { State } from './badge.tsx';

// The Versions of an Artifact as readPosting gives them, shared by the views of its tabs
type VersionState = 'running' | 'ready' | 'failed';

export const STATE_BY_VERSION_STATE: Record<VersionState, State> = {
  running: 'in_progress',
  ready: 'ready',
  failed: 'failed',
};

// Its Fixed Part and its Instructions as raw text, and the Chosen Versions it reads, of this Posting or
// of another one
export interface IPrompt {
  fixedPart: string;
  instructions: string;
  readVersionList: { reference: string; artifact: Artifact; interviewNumber: number | null; number: number }[];
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
  // The module that produces the Artifact, and why it cannot run now; else the Prompt a run started now
  // would receive
  module: { refusal: string | null; prompt: IPrompt | null };
  // Given by the action: jf edit opens its Chosen Version
  isEditable: boolean;
  versionList: {
    version: {
      number: number;
      state: VersionState;
      isChosen: boolean;
      hasCandidateInstructions: boolean;
      instructions: string;
      createdAt: Date;
    };
    isChoosable: boolean;
    documentList: { fileName: string; markdown: string; isModifiable: boolean }[];
  }[];
}
