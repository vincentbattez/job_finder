import { codedError } from '#/domain/coded-error.ts';
import {
  LIST_ITEM_SCHEMA,
  NEW_ITEM_SCHEMA,
  POSTING_DETAIL_SCHEMA,
  type ArtifactState,
  type Candidate,
  type ListItem,
  type NewItem,
  type Posting,
  type PostingDetail,
  type Recipients,
  type Version,
} from '#/domain/index.ts';
import { STATE_BY_JOB_STATE } from '#/domain/state.ts';
import { LETTER_MODULE } from '#/modules/letter/index.ts';
import { hasBeenApplied, listStatusChoices } from '#/status/index.ts';

import { ARTIFACT_INPUT_SCHEMA, LIST_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';
import { currentFoundReferencesOf } from './detect.ts';
import { findWorkerFailure } from './stalled-job.ts';

export function createPostingActions({ workspace, artifacts, findCandidate, findPosting, findLocale }: ActionContext) {
  // The Letter module reads the recipients of its Chosen Version; the Posting page, those of a Draft
  // before any is chosen, so they are read with the Letter they go with
  async function findRecipients(posting: Posting, { isDraftRead = false } = {}): Promise<Recipients | null> {
    const handle = await artifacts.find({ posting, artifact: 'letter' });
    const latestReady = handle.versionList.findLast(({ version }) => version.state === 'ready')?.version;
    const version = handle.chosenVersion ?? (isDraftRead ? latestReady : undefined);
    return version === undefined ? null : LETTER_MODULE.readRecipients(handle.directoryOf(version));
  }

  // The earlier Postings of its Position, the latest first, each the one the next publishes again
  async function listEarlierPostings(posting: Posting): Promise<Posting[]> {
    const earlierPostingList: Posting[] = [];
    let { repostOf } = posting;
    while (repostOf !== null) {
      const { reference } = repostOf;
      const postingList = await workspace.findPostings(reference);
      const earlierPosting = postingList.find(({ candidateId }) => candidateId === posting.candidateId);
      if (earlierPosting === undefined) {
        break;
      }
      earlierPostingList.push(earlierPosting);
      repostOf = earlierPosting.repostOf;
    }
    return earlierPostingList;
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

    // What the Candidate sorts: the New Postings they have not dismissed, those the last Detection found
    // flagged, which the list shows first (ADR-0018). Its count is the Sidebar's badge. Under the
    // Archived filter, the dismissed ones instead, which stay New (ADR-0007).
    async listNew(rawInput: unknown): Promise<NewItem[]> {
      const candidate = await findCandidate(rawInput);
      const { isArchived } = LIST_INPUT_SCHEMA.parse(rawInput);
      const postingList = await workspace.listPostings(candidate.id);
      const foundReferenceSet = new Set(currentFoundReferencesOf(await workspace.findDetections(candidate.id)));
      return postingList
        .filter(({ status, archivedAt }) => status === 'new' && (archivedAt !== null) === isArchived)
        .map((posting) => NEW_ITEM_SCHEMA.parse({ posting, isFound: foundReferenceSet.has(posting.reference) }));
    },

    // What the Candidate prepares: the To Apply Postings they still follow, the list groups them; under
    // the Archived filter, the Archived ones instead
    async listToApply(rawInput: unknown): Promise<ListItem[]> {
      const candidate = await findCandidate(rawInput);
      const { isArchived } = LIST_INPUT_SCHEMA.parse(rawInput);
      const postingList = await workspace.listPostings(candidate.id);
      return Promise.all(
        postingList
          .filter(({ status, archivedAt }) => status === 'to_apply' && (archivedAt !== null) === isArchived)
          .map(async (posting) => {
            const [research, letter] = await Promise.all([
              artifacts.find({ posting, artifact: 'research' }),
              artifacts.find({ posting, artifact: 'letter' }),
            ]);
            return LIST_ITEM_SCHEMA.parse({ posting, research: research.validation, letter: letter.validation });
          }),
      );
    },

    async readPosting(rawInput: unknown): Promise<PostingDetail> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      const locale = await findLocale(posting.candidateId);
      const jobList = await workspace.listJobs(posting);
      const extractionJob = jobList.findLast(({ module }) => module === 'extraction');
      const interviewList = await workspace.listInterviews(posting);
      const handleList = await artifacts.listOf(posting);
      const earlierPostingList = await listEarlierPostings(posting);
      const earlierApplication = earlierPostingList.find((earlierPosting) => hasBeenApplied(earlierPosting));
      const describedList = await Promise.all(
        handleList.map(async (handle) => ({
          interviewId: handle.interview?.id ?? null,
          entry: await handle.describe(),
        })),
      );
      // Every Version of each Artifact attached to the Posting, or to one of its Interviews
      const artifactListOf = (interviewId: number | null) =>
        describedList.filter((described) => described.interviewId === interviewId).map(({ entry }) => entry);
      return POSTING_DETAIL_SCHEMA.parse({
        posting,
        statusChoiceList: listStatusChoices({ ...posting, hasInterview: interviewList.length > 0 }),
        hasApplication: hasBeenApplied(posting),
        interviewList: interviewList.map((interview) => ({ ...interview, artifactList: artifactListOf(interview.id) })),
        jobDescription: workspace.readJobDescription(posting, locale),
        repost: {
          publicationNumber: earlierPostingList.length + 1,
          firstPublishedAt: (earlierPostingList.at(-1) ?? posting).publishedAt,
          earlierApplication:
            earlierApplication === undefined
              ? null
              : {
                  reference: earlierApplication.reference,
                  appliedAt: earlierApplication.appliedAt,
                  step: earlierApplication.step,
                },
        },
        artifactList: artifactListOf(null),
        customArtifactList: await artifacts.listCustomOf(posting),
        recipients: await findRecipients(posting, { isDraftRead: true }),
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
      const handle = await artifacts.find(ARTIFACT_INPUT_SCHEMA.parse(rawInput));
      return handle.versionList.map(({ version }) => version);
    },

    // What jf versions prints under the Versions: the reason the last job failed, even before its
    // Version, or makes no progress
    async readArtifactState(rawInput: unknown): Promise<ArtifactState> {
      const handle = await artifacts.find(ARTIFACT_INPUT_SCHEMA.parse(rawInput));
      return handle.readState();
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
