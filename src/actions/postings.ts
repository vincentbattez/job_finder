import { codedError } from '#/domain/coded-error.ts';
import {
  LIST_ITEM_SCHEMA,
  POSTING_DETAIL_SCHEMA,
  type ArtifactState,
  type Candidate,
  type ListItem,
  type Posting,
  type PostingDetail,
  type Recipients,
  type Version,
} from '#/domain/index.ts';
import { STATE_BY_JOB_STATE } from '#/domain/state.ts';
import { LETTER_MODULE } from '#/modules/letter/index.ts';
import { hasBeenApplied, listStatusChoices } from '#/status/index.ts';

import { ARTIFACT_INPUT_SCHEMA, REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';
import { findWorkerFailure } from './stalled-job.ts';

// The latest Postings of the home: enough to see at a glance what just arrived
const LATEST_POSTING_COUNT = 6;

export function createPostingActions({ workspace, artifacts, findCandidate, findPosting, findLocale }: ActionContext) {
  // The Letter module reads the recipients of its Chosen Version
  async function findRecipients(posting: Posting): Promise<Recipients | null> {
    const handle = await artifacts.find({ posting, artifact: 'letter' });
    const version = handle.chosenVersion;
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

    // What the Candidate prepares: the To Apply Postings they still follow, the list groups them
    async listToApply(rawInput: unknown): Promise<ListItem[]> {
      const candidate = await findCandidate(rawInput);
      const postingList = await workspace.listPostings(candidate.id);
      return Promise.all(
        postingList
          .filter(({ status, archivedAt }) => status === 'to_apply' && archivedAt === null)
          .map(async (posting) => {
            const [research, letter] = await Promise.all([
              artifacts.find({ posting, artifact: 'research' }),
              artifacts.find({ posting, artifact: 'letter' }),
            ]);
            return LIST_ITEM_SCHEMA.parse({ posting, research: research.validation, letter: letter.validation });
          }),
      );
    },

    // What the home shows of what just arrived, as tiles and on the map
    async listLatestPostings(rawInput: unknown): Promise<Posting[]> {
      const candidate = await findCandidate(rawInput);
      return workspace.listLatestPostings(candidate.id, LATEST_POSTING_COUNT);
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
