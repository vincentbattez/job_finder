import path from 'node:path';

import { z } from 'zod/v4';

import { codedError } from '#/domain/coded-error.ts';
import {
  ARTIFACT_SCHEMA,
  ARTIFACT_STATE_SCHEMA,
  POSTING_DETAIL_SCHEMA,
  VISUALIZATION_SCHEMA,
  type Artifact,
  type ArtifactState,
  type Candidate,
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
import { listNextStatuses } from '#/status/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import { ARTIFACT_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';
import { assertArtifactModifiable, assertChoosable, assertDocumentModifiable, isAccepted } from './edition.ts';
import { describeModule, findChosenVersion, parseArtifact } from './run-job.ts';

const VISUALIZATION_INPUT_SCHEMA = REFERENCE_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });

const STATE_BY_VERSION_STATE = { running: 'in_progress', ready: 'ready', failed: 'failed' } as const;
const STATE_BY_JOB_STATE = { queued: 'in_progress', running: 'in_progress', done: 'ready', failed: 'failed' } as const;

// The state of an Artifact follows its last job, unless a Version came after it: a job that failed
// before creating its Version, refused by findInputs, is failed rather than the previous Version's state
async function findArtifactState(
  workspace: Workspace,
  posting: Posting,
  artifact: Artifact,
  jobList: Job[],
): Promise<ArtifactState> {
  const versionList = await workspace.listVersions(posting, artifact);
  const lastVersion = versionList.at(-1);
  const lastJob = jobList.findLast(({ module }) => module === artifact);
  const isJobLatest =
    lastJob !== undefined && (lastJob.version === null || lastJob.version.number === lastVersion?.number);
  if (!isJobLatest) {
    return ARTIFACT_STATE_SCHEMA.parse({
      state: lastVersion === undefined ? 'absent' : STATE_BY_VERSION_STATE[lastVersion.state],
      failure: null,
    });
  }
  const { state, errorCode, log } = lastJob;
  return ARTIFACT_STATE_SCHEMA.parse({
    state: STATE_BY_JOB_STATE[state],
    failure: state === 'failed' ? { errorCode, log } : null,
  });
}

export function createPostingActions({ workspace, findCandidate, findPosting, findLocale }: ActionContext) {
  async function findRecipients(posting: Posting): Promise<Recipients | null> {
    const version = await findChosenVersion(workspace, posting, 'letter');
    return version === undefined ? null : LETTER_MODULE.readRecipients(workspace.versionDirectoryOf(posting, version));
  }

  function readDetailVersion(posting: Posting, version: Version, locale: Locale) {
    const { artifact, number, isChosen } = version;
    return {
      version,
      isChoosable:
        !isChosen &&
        isAccepted(() => {
          assertChoosable(posting, artifact, version, number, locale);
        }),
      documentList: workspace.readVersionDocuments(posting, version).map((document) => ({
        ...document,
        isModifiable: isAccepted(() => {
          assertDocumentModifiable(posting, artifact, version, document.fileName, locale);
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

    async readPosting(rawInput: unknown): Promise<PostingDetail> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const jobList = await workspace.listJobs(posting);
      const extractionJob = jobList.findLast(({ module }) => module === 'extraction');
      const artifactList = await Promise.all(
        ARTIFACT_SCHEMA.options.map(async (artifact) => {
          const versionList = await workspace.listVersions(posting, artifact);
          const chosenVersion = await findChosenVersion(workspace, posting, artifact);
          return {
            artifact,
            // A queued job has no Version yet, while the worker runs another one (ADR-0003), and a
            // claimed job has none until the worker starts it: both are already in progress
            ...(await findArtifactState(workspace, posting, artifact, jobList)),
            module: await describeModule(workspace, posting, artifact, locale),
            isEditable: isAccepted(() => {
              assertArtifactModifiable(posting, artifact, chosenVersion, locale);
            }),
            versionList: versionList.map((version) => readDetailVersion(posting, version, locale)),
          };
        }),
      );
      return POSTING_DETAIL_SCHEMA.parse({
        posting,
        nextStatusList: listNextStatuses(posting),
        jobDescription: workspace.readJobDescription(posting, locale),
        artifactList,
        recipients: await findRecipients(posting),
        extraction:
          extractionJob === undefined
            ? null
            : {
                state: STATE_BY_JOB_STATE[extractionJob.state],
                log: extractionJob.log,
                errorCode: extractionJob.errorCode,
              },
      });
    },

    async listVersions(rawInput: unknown): Promise<Version[]> {
      const { reference, artifact } = ARTIFACT_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      return workspace.listVersions(posting, parseArtifact(artifact, await findLocale(posting.candidateId)));
    },

    // What jf versions prints under the Versions: the reason the last job failed, even before its Version
    async readArtifactState(rawInput: unknown): Promise<ArtifactState> {
      const { reference, artifact } = ARTIFACT_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const parsedArtifact = parseArtifact(artifact, await findLocale(posting.candidateId));
      return findArtifactState(workspace, posting, parsedArtifact, await workspace.listJobs(posting));
    },

    async readVisualization(rawInput: unknown): Promise<Visualization> {
      const { reference, number } = VISUALIZATION_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const versionList = await workspace.listVersions(posting, 'visualization');
      const version = versionList.find((entry) => entry.number === number);
      if (version === undefined) {
        throw codedError('unknown_version', { reference, artifact: 'visualization', number }, { locale });
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
