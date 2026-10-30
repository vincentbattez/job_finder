import { z } from 'zod/v4';
import { fr } from 'zod/v4/locales';

import { DEFAULT_LOCALE, i18nOf } from './catalogue/i18n.ts';
import { ERROR_CATALOGUE, type ErrorCode } from './error.ts';
import type { Locale } from './locale.ts';

// Thrown by our code only through codedError, under a code of the catalogue (ADR-0015): the only
// Error class of src/, which test/architecture.test.ts holds to
class CodedError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, cause: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'CodedError';
    this.code = code;
  }
}

export type { CodedError };

// Zod words what is wrong with an input in French, the default locale: it does so while it parses,
// the only moment it still sees the value it refuses, before any Candidate is known (ADR-0012)
z.config(fr());

// Each input to correct, by its name, with what is wrong with it
function problemOf(error: z.ZodError): string {
  return error.issues
    .map(({ path: pathList, message }) => (pathList.length === 0 ? message : `« ${pathList.join('.')} » : ${message}`))
    .join('\n');
}

interface IErrorOption {
  // That of the Candidate the failure is for; before one is known, the default one
  locale?: Locale;
  // The foreign error a boundary ties to the code, kept for the stack
  cause?: unknown;
}

// The error of a code, its message worded with the values of the case in the Candidate's locale
export function codedError(
  code: ErrorCode,
  values: Record<string, unknown> = {},
  { locale = DEFAULT_LOCALE, cause }: IErrorOption = {},
): CodedError {
  return new CodedError(code, i18nOf(locale).t(ERROR_CATALOGUE[code], values), cause);
}

// What a boundary that catches anything gives on: an error of our code as is, any other one, from a
// library, the database or the network, under a code of the catalogue, so that none reaches the
// Candidate without one
export function codedErrorOf(error: unknown, locale: Locale = DEFAULT_LOCALE): CodedError {
  if (error instanceof CodedError) {
    return error;
  }
  if (error instanceof z.ZodError) {
    return codedError('invalid_input', { problem: problemOf(error) }, { locale, cause: error });
  }
  const reason = error instanceof Error ? error.message : String(error);
  return codedError('unexpected', { reason }, { locale, cause: error });
}

// How the CLI and the worker's logs print a failure: its code, then its message
export function formatError(error: unknown): string {
  const { code, message } = codedErrorOf(error);
  return `[${code}] ${message}`;
}
