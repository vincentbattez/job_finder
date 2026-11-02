import { describe, expect, it } from 'vitest';

import {
  daysUntil,
  groupByDeadline,
  isInPlace,
  isPlaceChangeOnly,
  readListFilters,
  tally,
  writeListFilters,
} from './list-model.ts';
import { regionBoundsOf } from './region-bounds.ts';

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

// Postings placed as API Géo places them: a City, a Region, either unknown
function placed(reference: string, city: string | null, region: string | null) {
  return { reference, city, region };
}

const PLACED_LIST = [
  placed('arras', 'Arras', 'Hauts-de-France'),
  placed('lille-1', 'Lille', 'Hauts-de-France'),
  placed('lyon', 'Lyon', 'Auvergne-Rhône-Alpes'),
  placed('lille-2', 'Lille', 'Hauts-de-France'),
  placed('nowhere', null, null),
  placed('amiens', 'Amiens', 'Hauts-de-France'),
];

describe('the common filters of a list', () => {
  it('reads them from the URL: several Cities, one Region, Archived', () => {
    expect(readListFilters(new URLSearchParams('city=Lille&city=Arras&region=Hauts-de-France&archived=on'))).toEqual({
      cityList: ['Lille', 'Arras'],
      region: 'Hauts-de-France',
      isArchived: true,
    });
    expect(readListFilters(new URLSearchParams('posting=2026-1&region='))).toEqual({
      cityList: [],
      region: null,
      isArchived: false,
    });
  });

  it('writes them into the URL, keeping its other parameters', () => {
    const written = writeListFilters(new URLSearchParams('posting=2026-1&city=Lyon'), {
      cityList: ['Lille', 'Arras'],
      region: null,
      isArchived: true,
    });

    expect(written.toString()).toBe('posting=2026-1&city=Lille&city=Arras&archived=on');
  });

  it('keeps the Postings of the chosen Cities, within the chosen Region', () => {
    const referencesOf = (filters: { cityList: string[]; region: string | null }) =>
      PLACED_LIST.filter((item) => isInPlace(item, filters)).map(({ reference }) => reference);

    expect(referencesOf({ cityList: [], region: null })).toHaveLength(PLACED_LIST.length);
    expect(referencesOf({ cityList: ['Lille', 'Lyon'], region: null })).toEqual(['lille-1', 'lyon', 'lille-2']);
    expect(referencesOf({ cityList: [], region: 'Hauts-de-France' })).toEqual([
      'arras',
      'lille-1',
      'lille-2',
      'amiens',
    ]);
    expect(referencesOf({ cityList: ['Lille', 'Lyon'], region: 'Hauts-de-France' })).toEqual(['lille-1', 'lille-2']);
  });

  it('offers each City with its count, the most frequent first, then alphabetically', () => {
    expect(tally(PLACED_LIST.map(({ city }) => city))).toEqual([
      { value: 'Lille', count: 2 },
      { value: 'Amiens', count: 1 },
      { value: 'Arras', count: 1 },
      { value: 'Lyon', count: 1 },
    ]);
  });
});

function urlOf(search: string): URL {
  return new URL(`http://localhost/to-apply${search}`);
}

describe('a move between two filtered URLs', () => {
  it('changes only the place when only the City or the Region does', () => {
    expect(isPlaceChangeOnly(urlOf('?city=Lille'), urlOf('?city=Lille&city=Arras&region=Corse'))).toBe(true);
  });

  it('changes more when Archived, another parameter or the page does, or nothing changes', () => {
    expect(isPlaceChangeOnly(urlOf('?city=Lille'), urlOf('?city=Lille&archived=on'))).toBe(false);
    expect(isPlaceChangeOnly(urlOf('?city=Lille'), urlOf('?city=Arras&posting=2026-1'))).toBe(false);
    expect(isPlaceChangeOnly(urlOf(''), new URL('http://localhost/?city=Lille'))).toBe(false);
    expect(isPlaceChangeOnly(urlOf('?city=Lille'), urlOf('?city=Lille'))).toBe(false);
  });
});

describe('the extent of a Region', () => {
  it('fits mainland and overseas Regions, whichever apostrophe their name takes', () => {
    expect(regionBoundsOf('Hauts-de-France')).toEqual([
      [48.83, 1.38],
      [51.09, 4.26],
    ]);
    expect(regionBoundsOf('Provence-Alpes-Côte d’Azur')).toEqual(regionBoundsOf("Provence-Alpes-Côte d'Azur"));
    expect(regionBoundsOf('Nouvelle-Calédonie')).toBeDefined();
  });

  it('has none for a Region it does not know', () => {
    expect(regionBoundsOf('Atlantis')).toBeUndefined();
  });
});
