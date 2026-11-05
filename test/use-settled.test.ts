import { describe, expect, it } from 'vitest';

import { createSettleMemory, settle } from '#/web/containers/use-settled.ts';

type Answer = { error: string | null } | undefined;

const SUCCESS = { error: null };
const OTHER_SUCCESS = { error: null };
const REFUSAL = { error: 'Refusée.' };

// The renders React shows of a fetcher, and what each of them settles
function settledOf(renderList: { state: 'idle' | 'submitting' | 'loading'; data: Answer }[], initial?: Answer) {
  const memory = createSettleMemory<Answer>(initial);
  return renderList.map((render) => settle(memory, render));
}

// React may skip the renders of a mutation under load: its toast was lost, and its form left as it was
describe('settling a mutation of a fetcher', () => {
  it('settles nothing on the first render', () => {
    expect(settledOf([{ state: 'idle', data: SUCCESS }], SUCCESS)).toEqual([null]);
  });

  it('settles a mutation seen leaving, with its answer', () => {
    expect(
      settledOf([
        { state: 'submitting', data: undefined },
        { state: 'loading', data: REFUSAL },
        { state: 'idle', data: REFUSAL },
      ]),
    ).toEqual([null, null, { answer: REFUSAL }]);
  });

  it('settles a mutation whose every render React skipped, by its new answer', () => {
    expect(settledOf([{ state: 'idle', data: OTHER_SUCCESS }], SUCCESS)).toEqual([{ answer: OTHER_SUCCESS }]);
  });

  it('settles each of two mutations that succeed in a row, once', () => {
    expect(
      settledOf([
        { state: 'idle', data: SUCCESS },
        { state: 'idle', data: OTHER_SUCCESS },
        { state: 'idle', data: OTHER_SUCCESS },
      ]),
    ).toEqual([{ answer: SUCCESS }, { answer: OTHER_SUCCESS }, null]);
  });

  it('does not take what a previous mutation left for the answer of a redirect', () => {
    expect(
      settledOf(
        [
          { state: 'submitting', data: REFUSAL },
          { state: 'idle', data: REFUSAL },
        ],
        REFUSAL,
      ),
    ).toEqual([null, { answer: undefined }]);
  });
});
