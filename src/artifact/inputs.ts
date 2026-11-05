import path from 'node:path';

import {
  ARTIFACT_SCHEMA,
  JOB_DESCRIPTION_FILE_NAME,
  ORIGINAL_FILE_NAME,
  profileDocumentKindOf,
  type Artifact,
  type InputKind,
  type InputMode,
  type InputReason,
  type Interview,
  type Posting,
  type Version,
} from '#/domain/index.ts';
import { hasBeenApplied } from '#/status/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import { AI_MODULE_BY_ARTIFACT, isAttachedToInterview, versionFileNameOf } from './registry.ts';

// Where an Artifact is attached: its Posting, and the Interview it prepares for an Artifact attached to
// one, else null
export interface ITarget {
  posting: Posting;
  interview: Interview | null;
}

// What a run reads, resolved from its AI module's declarations (ADR-0021)
export interface IInput {
  // Unique among the Inputs of a run, and recorded by the Version that read it: `job_description`,
  // `notes`, `artifact:<artifact>[@<interview>]`, `posting:<reference>/<artifact>` or `profile:<file name>`
  key: string;
  kind: InputKind;
  mode: InputMode;
  reason: InputReason | null;
  // A required Artifact without a Chosen Version: the run is refused until it has one
  isAvailable: boolean;
  // Its exact content
  content: string;
  wordCount: number;
  // The Artifact read, even one without a Chosen Version yet, then that Chosen Version and its Posting
  artifact: Artifact | null;
  readVersion: { posting: Posting; version: Version } | null;
  // The file of the Profile, for a document of the Profile
  fileName: string | null;
  // The title of a Custom Artifact
  title: string | null;
  // The day a Past Letter was added to the Profile or sent
  datedAt: Date | null;
}

// How many Past Letters a run checks by default, the most recent: the AI reads the current style
// without a pile of old letters
const RECENT_PAST_LETTER_COUNT = 5;

const JOB_DESCRIPTION_KEY = 'job_description';

function countWords(text: string): number {
  return text.split(/\s+/u).filter((word) => word !== '').length;
}

function inputOf(
  fields: Pick<IInput, 'key' | 'kind' | 'mode' | 'content'> & Partial<Omit<IInput, 'wordCount'>>,
): IInput {
  return {
    reason: null,
    isAvailable: true,
    artifact: null,
    readVersion: null,
    fileName: null,
    title: null,
    datedAt: null,
    ...fields,
    wordCount: countWords(fields.content),
  };
}

// The key of an Artifact of the run's own Posting, with the number of its Interview for one attached to it
function artifactKeyOf(artifact: Artifact, interview: Pick<Interview, 'number'> | null): string {
  const interviewSuffix = interview === null ? '' : `@${String(interview.number)}`;
  return `artifact:${artifact}${interviewSuffix}`;
}

// The Chosen Version of an Artifact where it is attached: on the Interview of the target, or on its Posting
export async function findChosenVersion(workspace: Workspace, { posting, interview }: ITarget, artifact: Artifact) {
  const versionList = await workspace.listVersions(
    posting,
    artifact,
    isAttachedToInterview(artifact) ? interview : null,
  );
  return versionList.find(({ isChosen }) => isChosen);
}

function readVersionContent(workspace: Workspace, posting: Posting, version: Version): string {
  return workspace.readVersionFile(posting, version, versionFileNameOf(version)) ?? '';
}

// A Letter as sent, then its Original as the AI wrote it, for a run that learns from the Candidate's
// corrections; the Original costs its full length in the Prompt too (ADR-0021). A Letter the Candidate
// brought has none.
function sentWithOriginalOf(workspace: Workspace, posting: Posting, version: Version): string {
  const sent = readVersionContent(workspace, posting, version);
  const original = workspace.readVersionFile(posting, version, ORIGINAL_FILE_NAME);
  return original === null
    ? sent
    : `### As sent\n\n${sent.trim()}\n\n### Its Original, as the AI wrote it\n\n${original.trim()}`;
}

// The Chosen Version of an Artifact as an Input; one not chosen yet is an Input only when required
async function artifactInputOf(
  workspace: Workspace,
  target: ITarget,
  artifact: Artifact,
  mode: InputMode,
): Promise<IInput | null> {
  const version = await findChosenVersion(workspace, target, artifact);
  if (version === undefined && mode !== 'required') {
    return null;
  }
  return inputOf({
    key: artifactKeyOf(artifact, isAttachedToInterview(artifact) ? target.interview : null),
    kind: 'artifact',
    mode,
    reason: mode === 'required' ? 'required_artifact' : null,
    isAvailable: version !== undefined,
    content: version === undefined ? '' : readVersionContent(workspace, target.posting, version),
    artifact,
    readVersion: version === undefined ? null : { posting: target.posting, version },
  });
}

// The Chosen Version of another Posting's Artifact, such as the one a Repost publishes again, or a Letter
// sent, with its Original for a run that reads them
async function otherPostingInputOf(
  workspace: Workspace,
  posting: Posting,
  artifact: Artifact,
  kind: InputKind,
  isWithOriginal = false,
): Promise<IInput | null> {
  const version = await findChosenVersion(workspace, { posting, interview: null }, artifact);
  return version === undefined
    ? null
    : inputOf({
        key: `posting:${posting.reference}/${artifact}`,
        kind,
        mode: 'default',
        content: isWithOriginal
          ? sentWithOriginalOf(workspace, posting, version)
          : readVersionContent(workspace, posting, version),
        artifact,
        readVersion: { posting, version },
        datedAt: kind === 'past_letter' ? posting.appliedAt : null,
      });
}

// The Interviews before the one a module runs for, by date as the Posting lists them
async function listPreviousInterviews(workspace: Workspace, { posting, interview }: ITarget) {
  if (interview === null) {
    return [];
  }
  const interviewList = await workspace.listInterviews(posting);
  return interviewList.slice(
    0,
    interviewList.findIndex(({ id }) => id === interview.id),
  );
}

// The Custom Artifacts of the Posting, and those of the Interview the run is for: every run of their
// Posting, or of their Interview, reads them by default (spec #125)
async function listCustomInputs(workspace: Workspace, { posting, interview }: ITarget): Promise<IInput[]> {
  const versionList = await workspace.listCustomVersions(posting);
  return versionList
    .filter((version) => version.interview === null || version.interview.number === interview?.number)
    .flatMap((version) =>
      version.customArtifact === null
        ? []
        : [
            inputOf({
              key: `custom:${String(version.customArtifact.id)}`,
              kind: 'custom_artifact',
              mode: 'default',
              content: readVersionContent(workspace, posting, version),
              title: version.customArtifact.title,
              readVersion: { posting, version },
            }),
          ],
    );
}

// A Repost starts from the work done for the Posting it publishes again
async function listRepostedInputs(workspace: Workspace, { repostOf, candidateId }: Posting) {
  const postingList = repostOf === null ? [] : await workspace.findPostings(repostOf.reference);
  const repostedPosting = postingList.find((posting) => posting.candidateId === candidateId);
  return repostedPosting === undefined
    ? []
    : Promise.all(
        ARTIFACT_SCHEMA.options
          .filter((artifact) => !isAttachedToInterview(artifact))
          .map((artifact) => otherPostingInputOf(workspace, repostedPosting, artifact, 'artifact')),
      );
}

// The Profile's documents: its core required, the Past Letters, of the Profile and sent from the tool,
// one set whose most recent are checked, and the Annexes to add. The Posting's own Letter is never one.
async function listProfileInputs(
  workspace: Workspace,
  posting: Posting,
  isReadingOriginals: boolean,
): Promise<IInput[]> {
  const documentList = workspace.readProfileDocuments(posting.candidateId).map(({ fileName, markdown, savedAt }) => {
    const documentKind = profileDocumentKindOf(fileName);
    // Its core, which every run that reads the Profile requires
    const isCore = documentKind === 'cv' || documentKind === 'facts';
    const isLetter = documentKind === 'past_letter';
    return inputOf({
      key: `profile:${fileName}`,
      kind: isLetter ? 'past_letter' : 'profile_document',
      mode: isCore ? 'required' : 'optional',
      reason: isCore ? 'profile_core' : null,
      content: markdown,
      fileName,
      datedAt: isLetter ? savedAt : null,
    });
  });
  const postingList = await workspace.listPostings(posting.candidateId);
  const sentList = await Promise.all(
    postingList
      .filter((other) => other.id !== posting.id && hasBeenApplied(other))
      .map((other) => otherPostingInputOf(workspace, other, 'letter', 'past_letter', isReadingOriginals)),
  );
  const pastLetterList = [
    ...documentList.filter(({ kind }) => kind === 'past_letter'),
    ...sentList.filter((input) => input !== null),
  ];
  const recentKeyList = new Set(
    pastLetterList
      .toSorted((first, second) => (second.datedAt?.getTime() ?? 0) - (first.datedAt?.getTime() ?? 0))
      .slice(0, RECENT_PAST_LETTER_COUNT)
      .map(({ key }) => key),
  );
  return [
    ...documentList.filter(({ mode }) => mode === 'required'),
    ...pastLetterList.map((input): IInput => ({
      ...input,
      mode: recentKeyList.has(input.key) ? 'default' : 'optional',
    })),
    ...documentList.filter(({ kind, mode }) => kind === 'profile_document' && mode === 'optional'),
  ];
}

// Every Input of a run, as its AI module declares them, in the order the run reads them
export async function resolveInputs(workspace: Workspace, target: ITarget, artifact: Artifact): Promise<IInput[]> {
  const { posting } = target;
  const aiModule = AI_MODULE_BY_ARTIFACT[artifact];
  const jobDescription = workspace.readTextFile(
    path.join(workspace.postingDirectoryOf(posting), JOB_DESCRIPTION_FILE_NAME),
  );
  const previousInterviewList = await listPreviousInterviews(workspace, target);
  const inputList = [
    inputOf({
      key: JOB_DESCRIPTION_KEY,
      kind: 'job_description',
      mode: 'required',
      reason: 'job_description',
      isAvailable: jobDescription !== null,
      content: jobDescription ?? '',
    }),
    ...(await Promise.all([
      ...(aiModule.requiredArtifactList ?? []).map((other) => artifactInputOf(workspace, target, other, 'required')),
      ...(aiModule.optionalArtifactList ?? []).map((other) => artifactInputOf(workspace, target, other, 'default')),
      ...previousInterviewList.flatMap((interview) =>
        (aiModule.previousInterviewArtifactList ?? []).map((other) =>
          artifactInputOf(workspace, { posting, interview }, other, 'default'),
        ),
      ),
    ])),
    aiModule.isReadingNotes === true && posting.notes.trim() !== ''
      ? inputOf({ key: 'notes', kind: 'notes', mode: 'default', content: posting.notes })
      : null,
    ...(await listCustomInputs(workspace, target)),
    ...(aiModule.isReadingRepostedPosting === true ? await listRepostedInputs(workspace, posting) : []),
    ...(aiModule.isReadingProfile === true
      ? await listProfileInputs(workspace, posting, aiModule.isReadingOriginals === true)
      : []),
  ];
  return inputList.filter((input) => input !== null);
}

// The keys a run checks by default, as jf run and an automatic run take them
export function defaultKeysOf(inputList: IInput[]): string[] {
  return inputList.filter(({ mode }) => mode !== 'optional').map(({ key }) => key);
}

// Checked when the panel opens: a regeneration prefills what the previous Version read. A Version
// migrated from before the Inputs were recorded only knows the Artifacts it read (spec #125).
export function isInitiallyChecked(input: IInput, previousVersion: Version | undefined): boolean {
  const isDefault = input.mode !== 'optional';
  if (previousVersion === undefined || input.mode === 'required' || previousVersion.inputList.length === 0) {
    return isDefault;
  }
  const isRead = previousVersion.inputList.some(({ key }) => key === input.key);
  // A Custom Artifact added since is new to the run: read by default
  if (input.kind === 'custom_artifact' && (input.readVersion?.version.createdAt ?? 0) > previousVersion.createdAt) {
    return isDefault;
  }
  // Every run records its Job Description: a record without it holds only the Versions read
  const isFullRecord = previousVersion.inputList.some(({ key }) => key === JOB_DESCRIPTION_KEY);
  return isFullRecord || input.readVersion !== null ? isRead : isDefault;
}
