import { describe, expect, it } from 'vitest';

import { countByApplicationTab, daysUntil, groupApplications, groupByDeadline } from './list-model.ts';

// 23:30 in Paris on 2 November 2026, already the 3rd in Paris an hour later: days count in Paris time
const NOW = new Date('2026-11-02T22:30:00Z');

// A Deadline is a day, stored at midnight UTC
function posting(reference: string, deadline: string | null, publishedAt = '2026-10-01') {
  return {
    reference,
    deadline: deadline === null ? null : new Date(`${deadline}T00:00:00Z`),
    publishedAt: new Date(`${publishedAt}T00:00:00Z`),
  };
}

describe('days until a Deadline', () => {
  it('counts 0 for today and goes negative once passed, in Paris time', () => {
    expect(daysUntil(new Date('2026-11-02T00:00:00Z'), NOW)).toBe(0);
    expect(daysUntil(new Date('2026-11-03T00:00:00Z'), NOW)).toBe(1);
    expect(daysUntil(new Date('2026-11-01T00:00:00Z'), NOW)).toBe(-1);
    expect(daysUntil(new Date('2026-12-03T00:00:00Z'), new Date('2026-11-02T23:30:00Z'))).toBe(30);
  });
});

describe('groups by Deadline', () => {
  it('puts each Posting in the first group that takes it, in order, empty groups left out', () => {
    const groupList = groupByDeadline(
      [
        posting('later', '2026-12-10'),
        posting('today', '2026-11-02'),
        posting('week-end', '2026-11-09'),
        posting('month-start', '2026-11-10'),
        posting('month-end', '2026-12-03'),
        posting('none-old', null, '2026-09-01'),
        posting('none-recent', null, '2026-10-20'),
        posting('passed-old', '2026-10-01'),
        posting('passed-recent', '2026-11-01'),
      ],
      NOW,
    );

    expect(groupList.map(({ key, itemList }) => [key, itemList.map(({ reference }) => reference)])).toEqual([
      ['week', ['today', 'week-end']],
      ['month', ['month-start', 'month-end']],
      ['later', ['later']],
      ['none', ['none-recent', 'none-old']],
      ['passed', ['passed-recent', 'passed-old']],
    ]);
  });

  it('leaves out the groups no Posting falls in', () => {
    expect(groupByDeadline([posting('later', '2027-03-01')], NOW).map(({ key }) => key)).toEqual(['later']);
  });
});

type ApplicationStep = 'applied' | 'invited' | 'interviewed' | 'hired' | 'rejected';

// A day of November 2026, null without one
function dateOf(day: string | undefined): Date | null {
  return day === undefined ? null : new Date(`2026-11-${day}T00:00:00Z`);
}

// An Application as the list groups it
function application(
  reference: string,
  step: ApplicationStep,
  dates: { deadline?: string; appliedAt?: string; nextInterviewAt?: string; lastInterviewAt?: string } = {},
) {
  return {
    reference,
    step,
    status: step === 'invited' || step === 'interviewed' ? 'applied' : step,
    deadline: dateOf(dates.deadline),
    appliedAt: dateOf(dates.appliedAt),
    nextInterviewAt: dateOf(dates.nextInterviewAt),
    lastInterviewAt: dateOf(dates.lastInterviewAt),
  };
}

describe('groups the Applications', () => {
  const itemList = [
    application('applied-late', 'applied', { deadline: '25' }),
    application('applied-none', 'applied'),
    application('applied-soon', 'applied', { deadline: '12' }),
    application('invited-late', 'invited', { nextInterviewAt: '20' }),
    application('invited-soon', 'invited', { nextInterviewAt: '15', lastInterviewAt: '01' }),
    application('interviewed-old', 'interviewed', { lastInterviewAt: '02' }),
    application('interviewed-recent', 'interviewed', { lastInterviewAt: '09' }),
    application('hired-old', 'hired', { appliedAt: '01' }),
    application('hired-recent', 'hired', { appliedAt: '05' }),
    application('rejected-recent', 'rejected', { appliedAt: '07' }),
    application('rejected-old', 'rejected', { appliedAt: '03' }),
  ];

  function groupsOf(tab: 'in_progress' | 'hired' | 'rejected') {
    return groupApplications(itemList, tab).map(({ key, itemList: groupItemList }) => [
      key,
      groupItemList.map(({ reference }) => reference),
    ]);
  }

  it('shows In progress as Interviewed by last Interview, Invited by next Interview, then Applied by Deadline', () => {
    expect(groupsOf('in_progress')).toEqual([
      ['interviewed', ['interviewed-recent', 'interviewed-old']],
      ['invited', ['invited-soon', 'invited-late']],
      ['applied', ['applied-soon', 'applied-late', 'applied-none']],
    ]);
  });

  it('sorts Hired and Rejected by the day Applied, the latest first', () => {
    expect(groupsOf('hired')).toEqual([['hired', ['hired-recent', 'hired-old']]]);
    expect(groupsOf('rejected')).toEqual([['rejected', ['rejected-recent', 'rejected-old']]]);
  });

  it('counts the Applications of each tab', () => {
    expect(countByApplicationTab(itemList)).toEqual({ in_progress: 7, hired: 2, rejected: 2 });
  });
});
