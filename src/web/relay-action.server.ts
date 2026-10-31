import { data } from 'react-router';

import { DEFAULT_LOCALE, type Locale } from '#/actions/i18n.ts';
import { codedErrorOf } from '#/actions/index.ts';

import { readCandidate } from './candidate.server.ts';
import type { ILoaderFailure, IRefusal } from './failure.ts';

// The Candidate's locale, or the default one when even the Candidate cannot be read
async function localeOf(request: Request): Promise<Locale> {
  try {
    const { locale } = await readCandidate(request);
    return locale;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// Every action of a route runs through here (test/architecture.test.ts): a failure goes back to the
// form that posted, in its code's message and the Candidate's locale, rather than replacing the page
// and what was typed in it (CODING_STANDARDS “Visible failure”). By default the refusal is { error };
// a route whose form needs to know where the failure belongs words it with refuse.
export function relayAction<TAnswer>(request: Request, run: () => Promise<TAnswer>): Promise<TAnswer | IRefusal>;
export function relayAction<TAnswer, TRefusal>(
  request: Request,
  run: () => Promise<TAnswer>,
  refuse: (message: string) => TRefusal,
): Promise<TAnswer | TRefusal>;
export async function relayAction(
  request: Request,
  run: () => Promise<unknown>,
  refuse = (error: string): IRefusal => ({ error }),
): Promise<unknown> {
  try {
    return await run();
  } catch (error) {
    // A redirect thrown on purpose is an answer, not a failure
    if (error instanceof Response) {
      throw error;
    }
    const { message } = codedErrorOf(error, await localeOf(request));
    return refuse(message);
  }
}

// Every loader of a route, and the root's, runs through here (test/architecture.test.ts): the error
// page shows a failure under its code, in the Candidate's locale, a foreign one under unexpected,
// never its raw message (ADR-0015)
export async function relayLoader<TAnswer>(request: Request, run: () => Promise<TAnswer> | TAnswer): Promise<TAnswer> {
  try {
    return await run();
  } catch (error) {
    // A redirect or a not found thrown on purpose is an answer, not a failure
    if (error instanceof Response) {
      throw error;
    }
    const { code, message } = codedErrorOf(error, await localeOf(request));
    throw data({ errorCode: code, message } satisfies ILoaderFailure, { status: 500 });
  }
}
