import { APPLICATION_SCHEMA, type Application, type Posting } from '#/domain/index.ts';
import { hasTakenPlace } from '#/domain/interview-time.ts';

import { LIST_INPUT_SCHEMA, type ActionContext } from './context.ts';

// An Application: Applied, Hired or Rejected, whether Archived or not (ADR-0007)
function isApplication({ status }: Posting): boolean {
  return status !== 'new' && status !== 'to_apply';
}

export function createApplicationActions({ workspace, findCandidate }: ActionContext) {
  // Its Interviews come by date (workspace.listInterviews)
  async function readApplication(posting: Posting, now: Date): Promise<Application> {
    const interviewList = await workspace.listInterviews(posting);
    const pastList = interviewList.filter((interview) => hasTakenPlace(interview, now));
    return APPLICATION_SCHEMA.parse({
      posting,
      nextInterviewAt: interviewList.find((interview) => !hasTakenPlace(interview, now))?.startAt ?? null,
      lastInterviewAt: pastList.at(-1)?.startAt ?? null,
    });
  }

  return {
    // What the Applications list shows: the followed Applications, or under the Archived filter the
    // Archived ones, which it splits into tabs and groups
    async listApplications(rawInput: unknown): Promise<Application[]> {
      const candidate = await findCandidate(rawInput);
      const { isArchived } = LIST_INPUT_SCHEMA.parse(rawInput);
      const now = new Date();
      const postingList = await workspace.listPostings(candidate.id);
      return Promise.all(
        postingList
          .filter((posting) => isApplication(posting) && (posting.archivedAt !== null) === isArchived)
          .map((posting) => readApplication(posting, now)),
      );
    },
  };
}
