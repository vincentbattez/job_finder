import { z } from 'zod/v4';

import { codedError } from '#/domain/coded-error.ts';
import type { Interview, Posting } from '#/domain/index.ts';
import { dateOfParisDateTime } from '#/domain/paris-time.ts';
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

    async deleteInterview(rawInput: unknown): Promise<void> {
      const { interview } = await findInterview(rawInput);
      await workspace.deleteInterview(interview);
    },
  };
}
