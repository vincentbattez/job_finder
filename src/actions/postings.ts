import path from 'node:path';

import { z } from 'zod/v4';

import { codedError } from '#/domain/coded-error.ts';
import {
  ARTIFACT_STATE_SCHEMA,
  POSTING_DETAIL_SCHEMA,
  VISUALIZATION_SCHEMA,
  type Artifact,
  type ArtifactState,
  type Candidate,
  type Interview,
  type Job,
  type Locale,
  type Posting,
  type PostingDetail,
  type Recipients,
  type Version,
  type Visualization,
} from '#/domain/index.ts';
import { LETTER_MODULE } from '#/modules/letter/index.ts';
import { VISUALIZATION_MODULE } from '#/modules/visualization/index.ts';
import { hasBeenApplied, listStatusChoices } from '#/status/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import { ARTIFACT_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';
import { assertArtifactModifiable, assertChoosable, assertDocumentModifiable, isAccepted } from './edition.ts';
import {
  commandOf,
  describeModule,
  findChosenVersion,
  findTarget,
  listTargetArtifacts,
  parseArtifact,
  type ITarget,
} from './run-job.ts';
import { findJobStall } from './stalled-job.ts';

const VISUALIZATION_INPUT_SCHEMA = REFERENCE_INPUT_SCHEMA.extend({
  interview: z.coerce.number().int(),
  number: z.coerce.number().int(),
});

// The latest Postings of the home: enough to see at a glance what just arrived
const LATEST_POSTING_COUNT = 6;

const STATE_BY_VERSION_STATE = { running: 'in_progress', ready: 'ready', failed: 'failed' } as const;
const STATE_BY_JOB_STATE = { queued: 'queued', running: 'in_progress', done: 'ready', failed: 'failed' } as const;

// The state of an Artifact follows its last job, unless a Version came after it: a job that failed
// before creating its Version, refused by findInputs, is failed rather than the previous Version's state
// Why the job makes no progress, in the Candidate's locale; null while it moves or once it is over
async function findWorkerFailure(workspace: Workspace, job: Job, locale: Locale) {
  const stall = await findJobStall(workspace, job, locale);
  return stall === undefined ? null : { errorCode: stall.code, message: stall.message };
}

async function findArtifactState(
  workspace: Workspace,
  { posting, interview }: ITarget,
  artifact: Artifact,
  jobList: Job[],
  locale: Locale,
): Promise<ArtifactState> {
  const versionList = await workspace.listVersions(posting, artifact, interview);
  const lastVersion = versionList.at(-1);
  // Those of its Interview only, for an Artifact attached to one
  const lastJob = jobList.findLast(
    (job) => job.module === artifact && (job.interview?.id ?? null) === (interview?.id ?? null),
  );
  const isJobLatest =
    lastJob !== undefined && (lastJob.version === null || lastJob.version.number === lastVersion?.number);
  if (!isJobLatest) {
    return ARTIFACT_STATE_SCHEMA.parse({
      state: lastVersion === undefined ? 'absent' : STATE_BY_VERSION_STATE[lastVersion.state],
      failure: null,
      notificationFailure: null,
      workerFailure: null,
    });
  }
  const { state, errorCode, log, notificationErrorCode, notificationFailure } = lastJob;
  return ARTIFACT_STATE_SCHEMA.parse({
    state: STATE_BY_JOB_STATE[state],
    failure: state === 'failed' ? { errorCode, log } : null,
    notificationFailure:
      notificationErrorCode === null ? null : { errorCode: notificationErrorCode, message: notificationFailure ?? '' },
    // That of this job only: a job overdue says nothing of the one queued behind it
    workerFailure: await findWorkerFailure(workspace, lastJob, locale),
  });
}

export function createPostingActions({ workspace, findCandidate, findPosting, findLocale }: ActionContext) {
  async function findRecipients(posting: Posting): Promise<Recipients | null> {
    const version = await findChosenVersion(workspace, { posting, interview: null }, 'letter');
    return version === undefined ? null : LETTER_MODULE.readRecipients(workspace.versionDirectoryOf(posting, version));
  }

  // Every Version of each Artifact attached to the target, the Posting or one of its Interviews
  async function readArtifactList(target: ITarget, jobList: Job[], candidate: Candidate, locale: Locale) {
    const { posting, interview } = target;
    return Promise.all(
      listTargetArtifacts(target).map(async (artifact) => {
        const versionList = await workspace.listVersions(posting, artifact, interview);
        const chosenVersion = versionList.find(({ isChosen }) => isChosen);
        return {
          artifact,
          // A queued job has no Version yet, while the worker runs another one (ADR-0003), and a
          // claimed job has none until the worker starts it: the job tells its state
          ...(await findArtifactState(workspace, target, artifact, jobList, locale)),
          module: await describeModule(workspace, target, artifact, candidate, locale),
          isEditable: isAccepted(() => {
            assertArtifactModifiable(target, artifact, chosenVersion, locale);
          }),
          versionList: versionList.map((version) => readDetailVersion(target, version, locale)),
        };
      }),
    );
  }

  function readDetailVersion(target: ITarget, version: Version, locale: Locale) {
    const { artifact, number, isChosen } = version;
    return {
      version,
      isChoosable:
        !isChosen &&
        isAccepted(() => {
          assertChoosable(target, artifact, version, number, locale);
        }),
      documentList: workspace.readVersionDocuments(target.posting, version).map((document) => ({
        ...document,
        isModifiable: isAccepted(() => {
          assertDocumentModifiable(target, artifact, version, document.fileName, locale);
        }),
      })),
    };
  }

  return {
    listCandidates(): Promise<Candidate[]> {
      return workspace.listCandidates();
    },

    // The Candidate a Posting belongs to: jf speaks their locale for a command on one of their Postings
    async readPostingCandidate(rawInput: unknown): Promise<Candidate> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      return findCandidate({ candidateId: posting.candidateId });
    },

    async listPostings(rawInput: unknown): Promise<Posting[]> {
      const candidate = await findCandidate(rawInput);
      return workspace.listPostings(candidate.id);
    },

    // What the home shows of what just arrived, as tiles and on the map
    async listLatestPostings(rawInput: unknown): Promise<Posting[]> {
      const candidate = await findCandidate(rawInput);
      return workspace.listLatestPostings(candidate.id, LATEST_POSTING_COUNT);
    },

    async readPosting(rawInput: unknown): Promise<PostingDetail> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const candidate = await findCandidate({ candidateId: posting.candidateId });
      const locale = await findLocale(posting.candidateId);
      const jobList = await workspace.listJobs(posting);
      const extractionJob = jobList.findLast(({ module }) => module === 'extraction');
      const interviewList = await workspace.listInterviews(posting);
      return POSTING_DETAIL_SCHEMA.parse({
        posting,
        statusChoiceList: listStatusChoices({ ...posting, hasInterview: interviewList.length > 0 }),
        hasApplication: hasBeenApplied(posting),
        interviewList: await Promise.all(
          interviewList.map(async (interview: Interview) => ({
            ...interview,
            artifactList: await readArtifactList({ posting, interview }, jobList, candidate, locale),
          })),
        ),
        jobDescription: workspace.readJobDescription(posting, locale),
        artifactList: await readArtifactList({ posting, interview: null }, jobList, candidate, locale),
        recipients: await findRecipients(posting),
        extraction:
          extractionJob === undefined
            ? null
            : {
                state: STATE_BY_JOB_STATE[extractionJob.state],
                log: extractionJob.log,
                errorCode: extractionJob.errorCode,
                workerFailure: await findWorkerFailure(workspace, extractionJob, locale),
              },
      });
    },

    // Those of the Interview named, for an Artifact attached to one
    async listVersions(rawInput: unknown): Promise<Version[]> {
      const { reference, artifact, interview } = ARTIFACT_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const parsedArtifact = parseArtifact(artifact, locale);
      const target = await findTarget(workspace, posting, parsedArtifact, interview, locale);
      return workspace.listVersions(posting, parsedArtifact, target.interview);
    },

    // What jf versions prints under the Versions: the reason the last job failed, even before its
    // Version, or makes no progress
    async readArtifactState(rawInput: unknown): Promise<ArtifactState> {
      const { reference, artifact, interview } = ARTIFACT_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const parsedArtifact = parseArtifact(artifact, locale);
      const target = await findTarget(workspace, posting, parsedArtifact, interview, locale);
      return findArtifactState(workspace, target, parsedArtifact, await workspace.listJobs(posting), locale);
    },

    async readVisualization(rawInput: unknown): Promise<Visualization> {
      const { reference, interview: interviewNumber, number } = VISUALIZATION_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const { interview } = await findTarget(workspace, posting, 'visualization', interviewNumber, locale);
      const versionList = await workspace.listVersions(posting, 'visualization', interview);
      const version = versionList.find((entry) => entry.number === number);
      if (version === undefined) {
        const command = commandOf(['versions', reference, 'visualization'], interview);
        throw codedError('unknown_version', { reference, artifact: 'visualization', number, command }, { locale });
      }
      const html = workspace.readTextFile(
        path.join(workspace.versionDirectoryOf(posting, version), VISUALIZATION_MODULE.fileName),
      );
      if (html === null) {
        throw codedError('visualization_without_page', { reference, number }, { locale });
      }
      return VISUALIZATION_SCHEMA.parse({ html });
    },

    async readRecipients(rawInput: unknown): Promise<Recipients> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const recipients = await findRecipients(posting);
      if (recipients === null) {
        throw codedError('no_chosen_letter', { reference }, { locale: await findLocale(posting.candidateId) });
      }
      return recipients;
    },
  };
}
