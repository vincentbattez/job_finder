import {
  APPLICATION_SCHEMA,
  APPLICATION_SECTION_NAME_SCHEMA,
  APPLICATION_SECTION_SCHEMA,
  type Application,
  type ApplicationSection,
  type ApplicationSectionName,
  type Interview,
  type Posting,
} from '#/domain/index.ts';
import { findInterviewEnd, hasBeenApplied, hasTakenPlace, listStatusChoices } from '#/status/index.ts';

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
function findLastChangeAt(posting: Posting, interviewList: Interview[], now: Date): Date {
  const timeList = [posting.statusChangedAt ?? posting.appliedAt, posting.archivedAt]
    .filter((date) => date !== null)
    .map((date) => date.getTime());
  const pastEndList = interviewList
    .filter((interview) => hasTakenPlace(interview, now))
    .map((interview) => findInterviewEnd(interview).getTime());
  return new Date(Math.max(0, ...timeList, ...pastEndList));
}

// The most recently changed first
function compareLastChanges(first: Application, second: Application): number {
  return second.lastChangeAt.getTime() - first.lastChangeAt.getTime();
}

// The most recently archived first: the archiving date sorts the Archived sections (ADR-0007)
function compareArchivedAt(first: Application, second: Application): number {
  return (second.posting.archivedAt?.getTime() ?? 0) - (first.posting.archivedAt?.getTime() ?? 0);
}

// The sections the archiving date sorts (ADR-0007)
const ARCHIVED_SECTION_SET = new Set<ApplicationSectionName>(['archived', 'archived_without_application']);

// The section of /applications a Posting goes in; none for a New or To Apply Posting still followed
function findSection(posting: Posting): ApplicationSectionName | null {
  if (posting.archivedAt !== null) {
    return hasBeenApplied(posting) ? 'archived' : 'archived_without_application';
  }
  const sectionByStatus = {
    new: null,
    to_apply: null,
    applied: 'in_progress',
    hired: 'hired',
    rejected: 'rejected',
  } as const;
  return sectionByStatus[posting.status];
}

export function createApplicationActions({ workspace, findCandidate }: ActionContext) {
  // A row: its Interviews come by date (workspace.listInterviews)
  async function readApplication(posting: Posting, now: Date): Promise<Application> {
    const interviewList = await workspace.listInterviews(posting);
    const upcomingInterview = interviewList.find((interview) => !hasTakenPlace(interview, now));
    return APPLICATION_SCHEMA.parse({
      posting,
      statusChoiceList: listStatusChoices({ ...posting, hasInterview: interviewList.length > 0 }),
      nextInterview: upcomingInterview ?? interviewList.at(-1) ?? null,
      hasUpcomingInterview: upcomingInterview !== undefined,
      interviewCount: interviewList.length,
      notesExcerpt: excerptOf(posting.notes),
      lastChangeAt: findLastChangeAt(posting, interviewList, now),
    });
  }

  return {
    // The historical record of /applications: every Application, and the Postings archived without one,
    // each section in its order with the most recently changed first, the Archived ones the most recently archived first
    async listApplications(rawInput: unknown): Promise<ApplicationSection[]> {
      const candidate = await findCandidate(rawInput);
      const now = new Date();
      const postingList = await workspace.listPostings(candidate.id);
      const applicationList = await Promise.all(
        postingList.filter((posting) => findSection(posting) !== null).map((posting) => readApplication(posting, now)),
      );
      return APPLICATION_SECTION_NAME_SCHEMA.options.map((section) =>
        APPLICATION_SECTION_SCHEMA.parse({
          section,
          applicationList: applicationList
            .filter(({ posting }) => findSection(posting) === section)
            .toSorted(ARCHIVED_SECTION_SET.has(section) ? compareArchivedAt : compareLastChanges),
        }),
      );
    },
  };
}
