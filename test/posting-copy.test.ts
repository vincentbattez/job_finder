import { describe, expect, it } from 'vitest';

import { tFor } from '#/actions/i18n.ts';

// The counted sentences of the Posting page, as Léa read them before i18next (ADR-0012)
describe('the counted copy of the Posting area', () => {
  const t = tFor('fr', 'posting');

  it('sums up a Detection by its count of new Postings', () => {
    expect(t('detectionSummary', { watchId: 'lea-1', count: 0 })).toBe('Veille lea-1 : aucune nouvelle Offre');
    expect(t('detectionSummary', { watchId: 'lea-1', count: 1 })).toBe('Veille lea-1 : 1 nouvelle Offre');
    expect(t('detectionSummary', { watchId: 'lea-1', count: 12 })).toBe('Veille lea-1 : 12 nouvelles Offres');
  });

  it('says a first launch imported without triggering anything', () => {
    expect(t('firstLaunchDetectionSummary', { watchId: 'lea-1', count: 3 })).toBe(
      'Veille lea-1 : 3 nouvelles Offres, premier lancement : importées sans rien déclencher',
    );
  });

  it('counts the Postings left off the map', () => {
    expect(t('unlocatedPostings', { count: 1 })).toBe('1 Offre sans coordonnées n’est pas sur la carte.');
    expect(t('unlocatedPostings', { count: 2 })).toBe('2 Offres sans coordonnées ne sont pas sur la carte.');
  });

  it('names a Version by its number', () => {
    expect(t('visualizationFrameTitle', { versionNumber: 2 })).toBe('Visualisation v2');
  });
});
