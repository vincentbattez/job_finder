import { z } from 'zod/v4';

import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import { ICAL_FILE_SCHEMA, type IcalFile, type Interview, type Locale, type Posting } from '#/domain/index.ts';
import { dateOfParisDateTime } from '#/domain/paris-time.ts';
import { formatCalendar } from '#/ical/index.ts';
import { hasBeenApplied } from '#/status/index.ts';

import { REFERENCE_INPUT_SCHEMA, type ActionContext } from './context.ts';

// An hour, unless the Candidate says otherwise
const DEFAULT_DURATION_MINUTES = 60;

// Typed in Paris time, as a datetime-local field or the CLI gives it: « 2026-11-19T14:00 »
const START_SCHEMA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .transform(dateOfParisDateTime)
  .refine((date) => !Number.isNaN(date.getTime()));

// The front and the CLI post text: the number and the duration are coerced
const FIELDS_SHAPE = {
  start: START_SCHEMA,
  durationMinutes: z.coerce.number().int().positive(),
  place: z.string(),
  interviewers: z.string(),
};

const NEW_INTERVIEW_INPUT_SCHEMA = REFERENCE_INPUT_SCHEMA.extend({
  ...FIELDS_SHAPE,
  durationMinutes: FIELDS_SHAPE.durationMinutes.default(DEFAULT_DURATION_MINUTES),
});

const INTERVIEW_INPUT_SCHEMA = REFERENCE_INPUT_SCHEMA.extend({ number: z.coerce.number().int() });

// A field left out keeps its value
const INTERVIEW_EDIT_INPUT_SCHEMA = INTERVIEW_INPUT_SCHEMA.extend(z.object(FIELDS_SHAPE).partial().shape);

// The address the Candidate opened Job Finder through: only its origin builds the links
const ICAL_INPUT_SCHEMA = INTERVIEW_INPUT_SCHEMA.extend({ origin: z.url().transform((url) => new URL(url).origin) });

// The sections of the Posting page to review before the Interview, by their anchor
const REVIEWED_ARTIFACT_LIST = ['research', 'letter', 'interview_brief'] as const;

const MINUTE_MS = 60_000;

// What the Candidate reviews from their phone before the Interview: the official ad, if the Posting has
// one, then the Posting page and its sections, all on the origin they opened Job Finder through
function describeLinks(posting: Posting, pageUrl: string, locale: Locale): string {
  const t = tFor(locale, 'posting');
  const linkList = [
    ...(posting.url === null ? [] : [{ label: t('ical.officialAd'), url: posting.url }]),
    { label: t('ical.postingPage'), url: pageUrl },
    ...REVIEWED_ARTIFACT_LIST.map((artifact) => ({
      label: t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' }),
      url: `${pageUrl}#${artifact}`,
    })),
  ];
  return linkList.map((link) => t('ical.link', link)).join('\n');
}

// An employer given on several lines stays on the single line of the event's title
function summarize(posting: Posting, locale: Locale): string {
  const t = tFor(locale, 'posting');
  const employer = posting.employer?.split('\n').join(' / ') ?? '';
  return employer === ''
    ? t('ical.summaryWithoutEmployer', { title: posting.title })
    : t('ical.summary', { title: posting.title, employer });
}

export function createInterviewActions({ workspace, findPosting, findLocale }: ActionContext) {
  async function findInterview(rawInput: unknown): Promise<{ posting: Posting; interview: Interview }> {
    const { reference, number } = INTERVIEW_INPUT_SCHEMA.parse(rawInput);
    const posting = await findPosting(reference);
    const interview = await workspace.findInterview(posting, number);
    if (interview === null) {
      throw codedError('unknown_interview', { reference, number }, { locale: await findLocale(posting.candidateId) });
    }
    return { posting, interview };
  }

  return {
    // By date, each with its number on its Posting
    async listInterviews(rawInput: unknown): Promise<Interview[]> {
      const { reference } = REFERENCE_INPUT_SCHEMA.parse(rawInput);
      return workspace.listInterviews(await findPosting(reference));
    },

    // Only an Application has Interviews: a To Apply Posting would get one before its Letter was sent
    async addInterview(rawInput: unknown): Promise<void> {
      const { reference, start, ...fields } = NEW_INTERVIEW_INPUT_SCHEMA.parse(rawInput);
      const posting = await findPosting(reference);
      if (!hasBeenApplied(posting)) {
        throw codedError(
          'interview_without_application',
          { reference },
          { locale: await findLocale(posting.candidateId) },
        );
      }
      await workspace.createInterview(posting, { ...fields, startAt: start });
    },

    async editInterview(rawInput: unknown): Promise<void> {
      const { interview } = await findInterview(rawInput);
      const edit = INTERVIEW_EDIT_INPUT_SCHEMA.parse(rawInput);
      await workspace.updateInterview(interview, {
        startAt: edit.start ?? interview.startAt,
        durationMinutes: edit.durationMinutes ?? interview.durationMinutes,
        place: edit.place ?? interview.place,
        interviewers: edit.interviewers ?? interview.interviewers,
      });
    },

    // Its UID is the Interview's id, never reused, unlike its number once the last one is deleted
    async readIcalFile(rawInput: unknown): Promise<IcalFile> {
      const { origin } = ICAL_INPUT_SCHEMA.parse(rawInput);
      const { posting, interview } = await findInterview(rawInput);
      const locale = await findLocale(posting.candidateId);
      const pageUrl = `${origin}/postings/${encodeURIComponent(posting.reference)}`;
      const text = formatCalendar({
        uid: `interview-${String(interview.id)}@job-finder`,
        sequence: interview.editCount,
        startAt: interview.startAt,
        endAt: new Date(interview.startAt.getTime() + interview.durationMinutes * MINUTE_MS),
        summary: summarize(posting, locale),
        location: interview.place,
        description: describeLinks(posting, pageUrl, locale),
        url: pageUrl,
        stampedAt: new Date(),
      });
      return ICAL_FILE_SCHEMA.parse({
        fileName: `interview-${posting.reference}-${String(interview.number)}.ics`,
        text,
      });
    },

    async deleteInterview(rawInput: unknown): Promise<void> {
      const { interview } = await findInterview(rawInput);
      await workspace.deleteInterview(interview);
    },
  };
}
