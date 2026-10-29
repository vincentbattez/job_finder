import { describe, expect, it } from 'vitest';

import { assertLettreModifiable, isExpiree } from './index.ts';

// A Date limite is a calendar day, stored at midnight UTC as the Source gives it; the day is over
// at midnight in France
describe('Expirée', () => {
  it.each([
    {
      case: 'its Date limite is tomorrow',
      offre: { dateLimite: new Date('2026-11-20'), publishedAt: null },
      now: '2026-11-19T12:00:00Z',
      isExpected: false,
    },
    {
      case: 'its Date limite is today, until midnight in France',
      offre: { dateLimite: new Date('2026-11-20'), publishedAt: null },
      now: '2026-11-20T22:30:00Z',
      isExpected: false,
    },
    {
      case: 'its Date limite was yesterday in France, though still today in UTC',
      offre: { dateLimite: new Date('2026-11-20'), publishedAt: null },
      now: '2026-11-20T23:30:00Z',
      isExpected: true,
    },
    {
      case: 'its Date limite is still to come, though it was published long ago',
      offre: { dateLimite: new Date('2026-11-20'), publishedAt: new Date('2025-01-06T10:00:00Z') },
      now: '2026-11-01T12:00:00Z',
      isExpected: false,
    },
    {
      case: 'it has no Date limite and was published less than the default delay ago',
      offre: { dateLimite: null, publishedAt: new Date('2026-04-30T10:00:00Z') },
      now: '2026-10-30T21:00:00Z',
      isExpected: false,
    },
    {
      case: 'it has no Date limite and was published more than the default delay ago',
      offre: { dateLimite: null, publishedAt: new Date('2026-04-30T10:00:00Z') },
      now: '2026-10-31T09:00:00Z',
      isExpected: true,
    },
    {
      case: 'it has no date at all',
      offre: { dateLimite: null, publishedAt: null },
      now: '2036-01-01T00:00:00Z',
      isExpected: false,
    },
  ])('is $isExpected when $case', ({ offre, now, isExpected }) => {
    expect(isExpiree(offre, new Date(now), 6)).toBe(isExpected);
  });

  it('counts the default delay given by the config', () => {
    const offre = { dateLimite: null, publishedAt: new Date('2026-08-14T10:00:00Z') };

    expect([
      isExpiree(offre, new Date('2026-10-29T12:00:00Z'), 2),
      isExpiree(offre, new Date('2026-10-29T12:00:00Z'), 3),
    ]).toEqual([true, false]);
  });
});

// The tickets that edit, regenerate or retain a Lettre test this rule through their own actions
describe('Lettre retenue of an Offre', () => {
  it('is frozen once the Offre is Postulée', () => {
    expect(() => {
      assertLettreModifiable({ reference: '2026-2445600', status: 'postulee', postuleeAt: new Date() });
    }).toThrow(/L'Offre 2026-2445600 a été Postulée : sa Lettre retenue est figée/);
  });

  it('stays frozen once the Postulée Offre is Archivée', () => {
    expect(() => {
      assertLettreModifiable({ reference: '2026-2445600', status: 'archivee', postuleeAt: new Date() });
    }).toThrow(/a été Postulée/);
  });

  // Postulée before the tool kept the date
  it('is frozen for an Offre Postulée without a date', () => {
    expect(() => {
      assertLettreModifiable({ reference: '2026-2445600', status: 'postulee', postuleeAt: null });
    }).toThrow(/a été Postulée/);
  });

  it.each(['a_traiter', 'archivee'] as const)('can still change while the Offre, never Postulée, is %s', (status) => {
    expect(() => {
      assertLettreModifiable({ reference: '2026-2445600', status, postuleeAt: null });
    }).not.toThrow();
  });
});
