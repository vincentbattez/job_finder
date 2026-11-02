import { describe, expect, it } from 'vitest';

import { tFor } from '#/actions/i18n.ts';

// The counted sentences of the Posting page, as Léa read them before i18next (ADR-0012)
describe('the counted copy of the Posting area', () => {
  const t = tFor('fr', 'posting');

  it('sums up what a Detection found on a Watch, by its count, French counting 0 apart', () => {
    const label = 'attaché de justice';
    expect(t('detection.nothingNew', { label, count: 81 })).toBe(
      'attaché de justice : la Source a listé 81 Offres, toutes déjà connues.',
    );
    expect(t('detection.nothingNew', { label, count: 0 })).toBe(
      'attaché de justice : la Source n’a listé aucune Offre.',
    );
    expect(t('detection.newPostings', { label, count: 1 })).toBe('attaché de justice : 1 nouvelle Offre.');
    expect(t('detection.newHeading', { count: 12 })).toBe('12 nouvelles Offres');
  });

  it('says a first launch imported without starting a Research or a notification', () => {
    expect(t('detection.firstLaunch', { label: 'attaché de justice', count: 81 })).toBe(
      'attaché de justice : premier lancement, 81 Offres importées, sans Recherche ni notification.',
    );
  });

  it('counts the Postings left off the map', () => {
    expect(t('unlocatedPostings', { count: 1 })).toBe('1 Offre sans coordonnées n’est pas sur la carte.');
    expect(t('unlocatedPostings', { count: 2 })).toBe('2 Offres sans coordonnées ne sont pas sur la carte.');
  });
});
