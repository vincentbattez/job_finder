// PROTOTYPE · a prototype-side hook on the real Fixed Part composers (src/modules/*/prompt.ts), whose
// behavior stays untouched: each module's composePrompt is wrapped so that, beside the text it returns,
// the same composer runs again on a copy of its input whose substituted values are wrapped in sentinels.
// The values are marked where the composer puts them, never guessed by searching the text. The
// Interview's start, formatted from a Date, cannot carry a sentinel: a parallel composition with the
// date shifted shows where it lands. Only the prototype server (no worker) loads this file.
import type { IPromptInput } from '#/ai-module/index.ts';
import { AI_MODULE_BY_ARTIFACT } from '#/artifact/registry.ts';

import { MARK_END, MARK_START } from './fixed-part.ts';

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
// Moves the year, the day, the hour and the minute of the Interview's start
const DATE_SHIFT_MS = 400 * DAY_MS + 61 * MINUTE_MS;
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/gu;
const WRAPPED = Symbol('prototype.fixedPartMarking');

// The composed text → the same text with its substituted values marked; on globalThis so a reloaded
// module still reads what the first wrapper writes
const markedByPlain: Map<string, string> = ((
  globalThis as { __prototypeMarkedFixedParts?: Map<string, string> }
).__prototypeMarkedFixedParts ??= new Map<string, string>());

function mark(value: string): string {
  return value === '' ? value : `${MARK_START}${value}${MARK_END}`;
}

function markNullable(value: string | null): string | null {
  return value === null ? null : mark(value);
}

// A number the composer only prints: String() and templates read its toString
function markNumber(value: number): number {
  return { toString: () => mark(String(value)), valueOf: () => value } as unknown as number;
}

function markedInputOf(input: IPromptInput): IPromptInput {
  const { posting, interview, notes } = input;
  return {
    posting: {
      ...posting,
      reference: mark(posting.reference),
      title: mark(posting.title),
      url: markNullable(posting.url),
      employer: markNullable(posting.employer),
      workplace: markNullable(posting.workplace),
      applicationEmail: markNullable(posting.applicationEmail),
      contact1: markNullable(posting.contact1),
      contact2: markNullable(posting.contact2),
    },
    interview:
      interview === null
        ? null
        : {
            ...interview,
            number: markNumber(interview.number),
            durationMinutes: markNumber(interview.durationMinutes),
            place: mark(interview.place),
            interviewers: mark(interview.interviewers),
          },
    notes: notes === null ? null : mark(notes.trim()),
    outputDirectory: mark(input.outputDirectory),
    profileDirectory: mark(input.profileDirectory),
    readVersionList: input.readVersionList.map((read) => ({
      ...read,
      reference: mark(read.reference),
      interviewNumber: read.interviewNumber === null ? null : markNumber(read.interviewNumber),
      directory: mark(read.directory),
      filePath: mark(read.filePath),
    })),
  };
}

// The dates that differ between the two compositions are the Interview's start
function markDates(marked: string, shifted: string): string {
  if (marked.length !== shifted.length) {
    return marked;
  }
  return marked.replaceAll(DATE_PATTERN, (match, offset: number) =>
    marked.slice(offset, offset + match.length) === shifted.slice(offset, offset + match.length) ? match : mark(match),
  );
}

function composeMarked(compose: (input: IPromptInput) => string, input: IPromptInput): string {
  const markedInput = markedInputOf(input);
  const marked = compose(markedInput);
  if (input.interview === null || markedInput.interview === null) {
    return marked;
  }
  const shifted = compose({
    ...markedInput,
    interview: { ...markedInput.interview, startAt: new Date(input.interview.startAt.getTime() + DATE_SHIFT_MS) },
  });
  return markDates(marked, shifted);
}

for (const aiModule of Object.values(AI_MODULE_BY_ARTIFACT)) {
  const current = aiModule.composePrompt as IAiComposer;
  if (current[WRAPPED] === true) {
    continue;
  }
  const compose = current.bind(aiModule);
  const wrapped: IAiComposer = (input) => {
    const plain = compose(input);
    try {
      markedByPlain.set(plain, composeMarked(compose, input));
    } catch {
      // No highlight rather than a broken page
    }
    return plain;
  };
  wrapped[WRAPPED] = true;
  aiModule.composePrompt = wrapped;
}

type IAiComposer = ((input: IPromptInput) => string) & { [WRAPPED]?: boolean };

// The Fixed Part with its substituted values between sentinels, null when it was not composed here
export function markedFixedPartOf(plain: string | null): string | null {
  return plain === null ? null : (markedByPlain.get(plain) ?? null);
}
