import { APPLICATION_SCHEMA, type Application, type Interview, type Posting } from '#/domain/index.ts';
import { findInterviewEnd, hasTakenPlace, listStatusChoices } from '#/status/index.ts';

import type { ActionContext } from './context.ts';

// What a row shows of the Notes: enough to remember where the Application stands
const EXCERPT_LINE_COUNT = 3;
const EXCERPT_MAX_LENGTH = 160;

// A heading, list or quote marker at the start of a Markdown line, and the emphasis marks
const LINE_MARKER_PATTERN = /^(?:#+|[-*+>]|\d+\.)\s+/;
const EMPHASIS_PATTERN = /[*_`]/g;

// The first lines of the Notes as plain text, cut at a word past the length a row has room for
function excerptOf(notes: string): string {
  const text = notes
    .split('\n')
    .map((line) => line.trim().replace(LINE_MARKER_PATTERN, '').replaceAll(EMPHASIS_PATTERN, '').trim())
    .filter((line) => line !== '')
    .slice(0, EXCERPT_LINE_COUNT)
    .join('\n');
  if (text.length <= EXCERPT_MAX_LENGTH) {
    return text;
  }
  const cut = text.slice(0, EXCERPT_MAX_LENGTH);
  const lastSpace = cut.search(/\s\S*$/);
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

// The last time the Application moved: its Status changed, it was archived or an Interview took place
function findLastChangeAt(posting: Posting, interviewList: Interview[], now: Date): number {
  const timeList = [posting.statusChangedAt ?? posting.appliedAt, posting.archivedAt]
    .filter((date) => date !== null)
    .map((date) => date.getTime());
  const pastEndList = interviewList
    .filter((interview) => hasTakenPlace(interview, now))
    .map((interview) => findInterviewEnd(interview).getTime());
  return Math.max(0, ...timeList, ...pastEndList);
}

// An upcoming Interview first, the nearest first, then the most recently changed (GLOSSARY.md « In progress »)
function compareApplications(
  [first, firstChangeAt]: [Application, number],
  [second, secondChangeAt]: [Application, number],
): number {
  if (first.hasUpcomingInterview !== second.hasUpcomingInterview) {
    return first.hasUpcomingInterview ? -1 : 1;
  }
  if (first.hasUpcomingInterview && first.nextInterview !== null && second.nextInterview !== null) {
    return first.nextInterview.startAt.getTime() - second.nextInterview.startAt.getTime();
  }
  return secondChangeAt - firstChangeAt;
}

export function createApplicationActions({ workspace, findCandidate }: ActionContext) {
  // A row and what sorts it: its Interviews come by date (workspace.listInterviews)
  async function readApplication(posting: Posting, now: Date): Promise<[Application, number]> {
    const interviewList = await workspace.listInterviews(posting);
    const upcomingInterview = interviewList.find((interview) => !hasTakenPlace(interview, now));
    const application = APPLICATION_SCHEMA.parse({
      posting,
      statusChoiceList: listStatusChoices(posting),
      nextInterview: upcomingInterview ?? interviewList.at(-1) ?? null,
      hasUpcomingInterview: upcomingInterview !== undefined,
      interviewCount: interviewList.length,
      notesExcerpt: excerptOf(posting.notes),
    });
    return [application, findLastChangeAt(posting, interviewList, now)];
  }

  return {
    // The overview of the home: the Applications with no outcome that the Candidate still follows
    async listApplicationsInProgress(rawInput: unknown): Promise<Application[]> {
      const candidate = await findCandidate(rawInput);
      const now = new Date();
      const postingList = await workspace.listPostings(candidate.id);
      const rowList = await Promise.all(
        postingList
          .filter(({ status, archivedAt }) => status === 'applied' && archivedAt === null)
          .map((posting) => readApplication(posting, now)),
      );
      return rowList.toSorted(compareApplications).map(([application]) => application);
    },
  };
}
