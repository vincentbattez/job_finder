import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Actions } from '#/actions/index.ts';

import { applyTo } from './apply.ts';
import { detectPostings } from './data-directory.ts';

const PLACE = 'Tribunal judiciaire, Béthune';

const NOW = new Date('2026-11-10T12:00:00Z');

function setDay(day: string) {
  vi.setSystemTime(new Date(`${day}T09:00:00Z`));
}

afterAll(() => {
  vi.useRealTimers();
});

// Every Application of /applications by section, and the Postings archived without one, from one Detection on
// the responses recorded on 2026-10-29: each Posting below moves on a day of its own, then the sections are read
// on 2026-11-10
describe('the Applications by section', () => {
  let actions: Actions;

  async function changeStatusOn(day: string, reference: string, status: string) {
    setDay(day);
    await (status === 'applied' ? applyTo(actions, reference) : actions.changeStatus({ reference, status }));
  }

  async function archiveOn(day: string, reference: string) {
    setDay(day);
    await actions.archive({ reference });
  }

  async function addInterview(reference: string, start: string) {
    await actions.addInterview({ reference, start, place: PLACE, interviewers: 'Mme Durand' });
  }

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    ({ actions } = await detectPostings());
    // In progress: an upcoming Interview does not put an Application first here
    await changeStatusOn('2026-11-01', '2026-2445600', 'applied');
    await addInterview('2026-2445600', '2026-11-20T10:00');
    await changeStatusOn('2026-11-02', '2026-2445609', 'applied');
    // Hired
    await changeStatusOn('2026-11-01', '2026-2445183', 'applied');
    await changeStatusOn('2026-11-03', '2026-2445183', 'hired');
    await changeStatusOn('2026-11-01', '2026-2360445', 'applied');
    await changeStatusOn('2026-11-05', '2026-2360445', 'hired');
    // Rejected: its Interview past on 2026-11-08 is its last change
    await changeStatusOn('2026-11-01', '2026-2231960', 'applied');
    await addInterview('2026-2231960', '2026-11-08T10:00');
    await changeStatusOn('2026-11-04', '2026-2231960', 'rejected');
    await changeStatusOn('2026-11-01', '2026-2360411', 'applied');
    await changeStatusOn('2026-11-06', '2026-2360411', 'rejected');
    // Archived, whatever their outcome
    await changeStatusOn('2026-11-01', '2026-2350473', 'applied');
    await archiveOn('2026-11-07', '2026-2350473');
    await changeStatusOn('2026-11-01', '2026-2338409', 'applied');
    await changeStatusOn('2026-11-02', '2026-2338409', 'hired');
    await archiveOn('2026-11-03', '2026-2338409');
    // Its Interview past on 2026-11-09 changes it last, but it was archived first
    await addInterview('2026-2338409', '2026-11-09T10:00');
    // Archived without an Application
    await archiveOn('2026-11-05', '2026-2199164');
    await archiveOn('2026-11-06', '2026-2445637');
    vi.setSystemTime(NOW);
  });

  async function listSections() {
    return actions.listApplications({ candidateId: 'lea' });
  }

  it('come in order, the most recently changed first or, once Archived, the most recently archived, and leave out the To Apply Postings', async () => {
    const sectionList = await listSections();

    expect(
      sectionList.map(({ section, applicationList }) => [
        section,
        applicationList.map(({ posting }) => posting.reference),
      ]),
    ).toEqual([
      ['hired', ['2026-2360445', '2026-2445183']],
      ['in_progress', ['2026-2445609', '2026-2445600']],
      ['rejected', ['2026-2231960', '2026-2360411']],
      ['archived', ['2026-2350473', '2026-2338409']],
      ['archived_without_application', ['2026-2445637', '2026-2199164']],
    ]);
  });

  it('give the rows of the home, a dismissed New Posting offering no Status, kept or dismissed instead', async () => {
    const sectionList = await listSections();
    const rowList = sectionList.flatMap(({ applicationList }) => applicationList);

    expect(rowList.find(({ posting }) => posting.reference === '2026-2445600')).toMatchObject({
      posting: { step: 'invited' },
      statusChoiceList: ['hired', 'rejected'],
      nextInterview: { number: 1 },
      hasUpcomingInterview: true,
      interviewCount: 1,
    });
    expect(rowList.find(({ posting }) => posting.reference === '2026-2199164')).toMatchObject({
      posting: { status: 'new' },
      statusChoiceList: [],
      nextInterview: null,
      lastChangeAt: new Date('2026-11-05T09:00:00Z'),
    });
  });

  it('are refused for an unknown Candidate', async () => {
    await expect(actions.listApplications({ candidateId: 'nobody' })).rejects.toThrow(/nobody/);
  });
});
