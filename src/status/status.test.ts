import { describe, expect, it } from 'vitest';

import { assertLetterModifiable, isExpired } from './index.ts';

// A Deadline is a calendar day, stored at midnight UTC as the Source gives it; the day is over
// at midnight in France
describe('Expired', () => {
  it.each([
    {
      case: 'its Deadline is tomorrow',
      posting: { deadline: new Date('2026-11-20'), publishedAt: null },
      now: '2026-11-19T12:00:00Z',
      isExpected: false,
    },
    {
      case: 'its Deadline is today, until midnight in France',
      posting: { deadline: new Date('2026-11-20'), publishedAt: null },
      now: '2026-11-20T22:30:00Z',
      isExpected: false,
    },
    {
      case: 'its Deadline was yesterday in France, though still today in UTC',
      posting: { deadline: new Date('2026-11-20'), publishedAt: null },
      now: '2026-11-20T23:30:00Z',
      isExpected: true,
    },
    {
      case: 'its Deadline is still to come, though it was published long ago',
      posting: { deadline: new Date('2026-11-20'), publishedAt: new Date('2025-01-06T10:00:00Z') },
      now: '2026-11-01T12:00:00Z',
      isExpected: false,
    },
    {
      case: 'it has no Deadline and was published less than the default delay ago',
      posting: { deadline: null, publishedAt: new Date('2026-04-30T10:00:00Z') },
      now: '2026-10-30T21:00:00Z',
      isExpected: false,
    },
    {
      case: 'it has no Deadline and was published more than the default delay ago',
      posting: { deadline: null, publishedAt: new Date('2026-04-30T10:00:00Z') },
      now: '2026-10-31T09:00:00Z',
      isExpected: true,
    },
    {
      case: 'it has no date at all',
      posting: { deadline: null, publishedAt: null },
      now: '2036-01-01T00:00:00Z',
      isExpected: false,
    },
  ])('is $isExpected when $case', ({ posting, now, isExpected }) => {
    expect(isExpired(posting, new Date(now), 6)).toBe(isExpected);
  });

  it('counts the default delay given by the config', () => {
    const posting = { deadline: null, publishedAt: new Date('2026-08-14T10:00:00Z') };

    expect([
      isExpired(posting, new Date('2026-10-29T12:00:00Z'), 2),
      isExpired(posting, new Date('2026-10-29T12:00:00Z'), 3),
    ]).toEqual([true, false]);
  });
});

// The tickets that edit, regenerate or retain a Letter test this rule through their own actions
describe('Chosen Letter of a Posting', () => {
  it('is frozen once the Posting is Applied', () => {
    expect(() => {
      assertLetterModifiable({ reference: '2026-2445600', status: 'applied', appliedAt: new Date() }, 'fr');
    }).toThrow(/L'Offre 2026-2445600 a été Postulée : sa Lettre retenue est figée/);
  });

  it('stays frozen once the Applied Posting is Archived', () => {
    expect(() => {
      assertLetterModifiable({ reference: '2026-2445600', status: 'archived', appliedAt: new Date() }, 'fr');
    }).toThrow(/a été Postulée/);
  });

  // Applied before the tool kept the date
  it('is frozen for an Applied Posting without a date', () => {
    expect(() => {
      assertLetterModifiable({ reference: '2026-2445600', status: 'applied', appliedAt: null }, 'fr');
    }).toThrow(/a été Postulée/);
  });

  it.each(['to_apply', 'archived'] as const)('can still change while the Posting, never Applied, is %s', (status) => {
    expect(() => {
      assertLetterModifiable({ reference: '2026-2445600', status, appliedAt: null }, 'fr');
    }).not.toThrow();
  });
});
