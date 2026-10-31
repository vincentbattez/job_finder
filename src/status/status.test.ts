import { describe, expect, it } from 'vitest';

import { assertLetterModifiable, assertStatusChange, isExpired, listStatusChoices } from './index.ts';

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

  // Applied before the tool kept the date
  it('is frozen for an Applied Posting without a date', () => {
    expect(() => {
      assertLetterModifiable({ reference: '2026-2445600', status: 'applied', appliedAt: null }, 'fr');
    }).toThrow(/a été Postulée/);
  });

  it('can still change while the Posting was never Applied', () => {
    expect(() => {
      assertLetterModifiable({ reference: '2026-2445600', status: 'to_apply', appliedAt: null }, 'fr');
    }).not.toThrow();
  });
});

// The selector offers only these: Applied on a To Apply Posting, then the other two of In progress
// (Applied), Hired and Rejected on an Application
describe('Status choices of a Posting', () => {
  it.each([
    { status: 'to_apply', appliedAt: null, expectedList: ['applied'] },
    { status: 'applied', appliedAt: new Date(), expectedList: ['hired', 'rejected'] },
    { status: 'hired', appliedAt: new Date(), expectedList: ['applied', 'rejected'] },
    { status: 'rejected', appliedAt: new Date(), expectedList: ['applied', 'hired'] },
  ] as const)('are $expectedList from $status', ({ status, appliedAt, expectedList }) => {
    expect(listStatusChoices({ status, appliedAt })).toEqual(expectedList);
  });
});

describe('Status change of a Posting', () => {
  const APPLIED_AT = new Date('2026-10-29T12:00:00Z');

  it.each([
    { from: 'to_apply', to: 'applied' },
    { from: 'applied', to: 'hired' },
    { from: 'applied', to: 'rejected' },
    { from: 'hired', to: 'rejected' },
    { from: 'rejected', to: 'hired' },
    { from: 'hired', to: 'applied' },
    { from: 'rejected', to: 'applied' },
    { from: 'hired', to: 'hired' },
  ] as const)('allows $from to $to', ({ from, to }) => {
    const posting = { reference: '2026-2445600', status: from, appliedAt: from === 'to_apply' ? null : APPLIED_AT };

    expect(() => {
      assertStatusChange(posting, to, 'fr');
    }).not.toThrow();
  });

  // An outcome only comes once the Application started
  it.each(['hired', 'rejected'] as const)('refuses To Apply to %s', (status) => {
    expect(() => {
      assertStatusChange({ reference: '2026-2445600', status: 'to_apply', appliedAt: null }, status, 'en');
    }).toThrow('Posting 2026-2445600 is To Apply: it can only move to Applied.');
  });

  // The Chosen Letter was sent: an Application never goes back to To Apply, whatever its outcome
  it.each(['applied', 'hired', 'rejected'] as const)('refuses %s back to To Apply', (status) => {
    expect(() => {
      assertStatusChange({ reference: '2026-2445600', status, appliedAt: APPLIED_AT }, 'to_apply', 'en');
    }).toThrow('Posting 2026-2445600 was Applied: it never goes back to To Apply');
  });
});
