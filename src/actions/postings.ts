import path from 'node:path';

import { z } from 'zod/v4';

import {
  ARTIFACT_SCHEMA,
  POSTING_DETAIL_SCHEMA,
  VISUALIZATION_SCHEMA,
  type Candidate,
  type Posting,
  type PostingDetail,
  type Recipients,
  type Version,
  type Visualization,
} from '#/domain/index.ts';
import { LETTER_MODULE } from '#/modules/letter/index.ts';
import { VISUALIZATION_MODULE } from '#/modules/visualization/index.ts';
import { listNextStatuses } from '#/status/index.ts';

import { ARTIFACT_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';
import { assertArtifactModifiable, assertChoosable, assertDocumentModifiable, isAccepted } from './edition.ts';
import { describeModule, findChosenVersion, parseArtifact } from './run-job.ts';

const VISUALIZATION_INPUT_SCHEMA = REFERENCE_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });

const STATE_BY_VERSION_STATE = { running: 'in_progress', ready: 'ready', failed: 'failed' } as const;
const STATE_BY_JOB_STATE = { queued: 'in_progress', running: 'in_progress', done: 'ready', failed: 'failed' } as const;

export function createPostingActions({ workspace, findCandidate, findPosting }: ActionContext) {
  async function findRecipients(posting: Posting): Promise<Recipients | null> {
    const version = await findChosenVersion(workspace, posting, 'letter');
    return version === undefined ? null : LETTER_MODULE.readRecipients(workspace.versionDirectoryOf(posting, version));
  }

  function readDetailVersion(posting: Posting, version: Version) {
    const { artifact, number, isChosen } = version;
    return {
      version,
      isChoosable:
        !isChosen &&
        isAccepted(() => {
          assertChoosable(posting, artifact, version, number);
        }),
      documentList: workspace.readVersionDocuments(posting, version).map((document) => ({
        ...document,
        isModifiable: isAccepted(() => {
          assertDocumentModifiable(posting, artifact, version, document.fileName);
        }),
      })),
    };
  }

  return {
    listCandidates(): Promise<Candidate[]> {
      return workspace.listCandidates();
    },

    async listPostings(rawInput: unknown): Promise<Posting[]> {
      const candidate = await findCandidate(rawInput);
      return workspace.listPostings(candidate.id);
    },

    async readPosting(rawInput: unknown): Promise<PostingDetail> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const jobList = await workspace.listJobs(posting);
      const extractionJob = jobList.findLast(({ module }) => module === 'extraction');
      const artifactList = await Promise.all(
        ARTIFACT_SCHEMA.options.map(async (artifact) => {
          const versionList = await workspace.listVersions(posting, artifact);
          const chosenVersion = await findChosenVersion(workspace, posting, artifact);
          // A queued job has no Version yet, while the worker runs another one (ADR-0003), and a
          // claimed job has none until the worker starts it: both are already en cours
          const isPending = jobList.some(
            ({ module, state }) => module === artifact && (state === 'queued' || state === 'running'),
          );
          const state = isPending ? 'running' : versionList.at(-1)?.state;
          return {
            artifact,
            state: state === undefined ? 'absent' : STATE_BY_VERSION_STATE[state],
            module: await describeModule(workspace, posting, artifact),
            isEditable: isAccepted(() => {
              assertArtifactModifiable(posting, artifact, chosenVersion);
            }),
            versionList: versionList.map((version) => readDetailVersion(posting, version)),
          };
        }),
      );
      return POSTING_DETAIL_SCHEMA.parse({
        posting,
        nextStatusList: listNextStatuses(posting),
        jobDescription: workspace.readJobDescription(posting),
        artifactList,
        recipients: await findRecipients(posting),
        extraction:
          extractionJob === undefined
            ? null
            : { state: STATE_BY_JOB_STATE[extractionJob.state], log: extractionJob.log },
      });
    },

    async listVersions(rawInput: unknown): Promise<Version[]> {
      const { reference, artifact } = ARTIFACT_INPUT_SCHEMA.parse(rawInput);
      return workspace.listVersions(await findPosting(reference), parseArtifact(artifact));
    },

    async readVisualization(rawInput: unknown): Promise<Visualization> {
      const { reference, number } = VISUALIZATION_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const versionList = await workspace.listVersions(posting, 'visualization');
      const version = versionList.find((entry) => entry.number === number);
      if (version === undefined) {
        throw new Error(
          `Version inconnue : visualization v${String(number)} de l'Offre ${reference}. « jf versions ${reference} visualization » liste ses Versions.`,
        );
      }
      const html = workspace.readTextFile(
        path.join(workspace.versionDirectoryOf(posting, version), VISUALIZATION_MODULE.fileName),
      );
      if (html === null) {
        throw new Error(
          `La Visualisation v${String(number)} de l'Offre ${reference} n'a pas de page : relancez la Visualisation.`,
        );
      }
      return VISUALIZATION_SCHEMA.parse({ html });
    },

    async readRecipients(rawInput: unknown): Promise<Recipients> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const recipients = await findRecipients(await findPosting(reference));
      if (recipients === null) {
        throw new Error(`L'Offre ${reference} n'a pas de Lettre retenue. La produire : jf run letter ${reference}.`);
      }
      return recipients;
    },
  };
}
