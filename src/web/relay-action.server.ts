import { codedErrorOf } from '#/actions/index.ts';

import { readCandidate } from './candidate.server.ts';

interface IRefusal {
  error: string;
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
  refuse = (error: string): unknown => ({ error }),
): Promise<unknown> {
  try {
    return await run();
  } catch (error) {
    // A redirect thrown on purpose is an answer, not a failure
    if (error instanceof Response) {
      throw error;
    }
    const { locale } = await readCandidate(request);
    return refuse(codedErrorOf(error, locale).message);
  }
}
