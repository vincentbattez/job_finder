import { APPLICATION_SCHEMA, type Application, type Posting } from '#/domain/index.ts';
import { hasTakenPlace } from '#/status/index.ts';

import type { ActionContext } from './context.ts';

// An Application the Candidate still follows: Applied, Hired or Rejected, not Archived (ADR-0007)
function isFollowedApplication({ status, archivedAt }: Posting): boolean {
  return status !== 'new' && status !== 'to_apply' && archivedAt === null;
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
    // What the Applications list shows: the followed Applications, which it splits into tabs and groups
    async listApplications(rawInput: unknown): Promise<Application[]> {
      const candidate = await findCandidate(rawInput);
      const now = new Date();
      const postingList = await workspace.listPostings(candidate.id);
      return Promise.all(
        postingList.filter((posting) => isFollowedApplication(posting)).map((posting) => readApplication(posting, now)),
      );
    },
  };
}
