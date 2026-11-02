import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Actions } from '#/actions/index.ts';

import { applyTo } from './apply.ts';
import { detectPostings } from './data-directory.ts';

const PLACE = 'Tribunal judiciaire, Béthune';

const NOW = new Date('2026-11-10T12:00:00Z');

afterAll(() => {
  vi.useRealTimers();
});

// The Applications list (spec #125 « Lists »): the followed Applications, each with when its next
// Interview comes and when its last one took place, from one Detection on the responses recorded on
// 2026-10-29, read on 2026-11-10
describe('the Applications list', () => {
  let actions: Actions;

  async function addInterview(reference: string, start: string) {
    await actions.addInterview({ reference, start, place: PLACE, interviewers: 'Mme Durand' });
  }

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    ({ actions } = await detectPostings());
    // Applied, without any Interview
    await applyTo(actions, '2026-2445609');
    // Invited: one Interview past, the next to come
    await applyTo(actions, '2026-2445600');
    await addInterview('2026-2445600', '2026-11-05T10:00');
    await addInterview('2026-2445600', '2026-11-20T10:00');
    // Interviewed: both its Interviews past
    await applyTo(actions, '2026-2231960');
    await addInterview('2026-2231960', '2026-11-03T10:00');
    await addInterview('2026-2231960', '2026-11-08T10:00');
    // Hired and Rejected
    await applyTo(actions, '2026-2445183');
    await actions.changeStatus({ reference: '2026-2445183', status: 'hired' });
    await applyTo(actions, '2026-2360411');
    await actions.changeStatus({ reference: '2026-2360411', status: 'rejected' });
    // Archived: the Archived filter shows it, not the followed list
    await applyTo(actions, '2026-2350473');
    await actions.archive({ reference: '2026-2350473' });
    // To Apply: not an Application
    await actions.keep({ reference: '2026-2338409' });
    vi.setSystemTime(NOW);
  });

  it('lists the followed Applications, each with its Step and its next and last Interviews', async () => {
    const itemList = await actions.listApplications({ candidateId: 'lea' });

    expect(
      itemList
        .map(({ posting, nextInterviewAt, lastInterviewAt }) => [
          posting.reference,
          posting.step,
          nextInterviewAt?.toISOString() ?? null,
          lastInterviewAt?.toISOString() ?? null,
        ])
        .toSorted(([first], [second]) => String(first).localeCompare(String(second))),
    ).toEqual([
      ['2026-2231960', 'interviewed', null, '2026-11-08T09:00:00.000Z'],
      ['2026-2360411', 'rejected', null, null],
      ['2026-2445183', 'hired', null, null],
      ['2026-2445600', 'invited', '2026-11-20T09:00:00.000Z', '2026-11-05T09:00:00.000Z'],
      ['2026-2445609', 'applied', null, null],
    ]);
  });

  it('lists the Archived Applications apart, under Archived', async () => {
    const itemList = await actions.listApplications({ candidateId: 'lea', isArchived: true });

    expect(itemList.map(({ posting }) => posting.reference)).toEqual(['2026-2350473']);
  });

  it('is refused for an unknown Candidate', async () => {
    await expect(actions.listApplications({ candidateId: 'nobody' })).rejects.toThrow(/nobody/);
  });
});
