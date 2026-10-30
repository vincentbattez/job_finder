import { describe, expect, it } from 'vitest';

import { readCity } from './city.ts';

// Places d'affectation of the PEP Postings recorded on 2026-10-29, written as free text
describe('city of a place d’affectation', () => {
  it.each([
    ['Tribunal Judiciaire de Béthune', 'Béthune'],
    ['Le siège du Tribunal Judiciaire de Sens', 'Sens'],
    ['Parquet de la Cour d’Appel de Paris', 'Paris'],
    ["Tribunal judiciaire d'Auxerre", 'Auxerre'],
    ['TRIBUNAL JUDICIAIRE DE BLOIS', 'BLOIS'],
    ['Tribunal judiciaire de La Rochelle (17000)', 'La Rochelle'],
    ['Tribunal de première instance de Nouméa', 'Nouméa'],
    ['CA DOUAI - TJ BOULOGNE SUR MER', 'BOULOGNE SUR MER'],
    ["11 rue du Maréchal Joffre, 59440 - TJ d'Avesnes-sur-Helpe", 'Avesnes-sur-Helpe'],
    ['quai Finkmatt 67000 STRASBOURG', 'STRASBOURG'],
    ['1 avenue Pierre Mendès France 72 014 LE MANS CEDEX ', 'LE MANS'],
    ["Tribunal judiciaire d'Evry - 9 Rue des Mazières, 91000 Évry-Courcouronnes", 'Évry-Courcouronnes'],
    ["11, rue Dumont d'urville CS 45257, 14052 Caen", 'Caen'],
    ['Tribunal Judiciaire de Thonon les Bains, 10 rue de l’Hotel Dieu, 74200 Thonon les bains', 'Thonon les bains'],
    ['Cour de cassation - SDER - l’Observatoire des litiges judiciaires', 'Paris'],
    ['Aix en provence', 'Aix en provence'],
    ['Cayenne', 'Cayenne'],
  ])('reads « %s » as %s', (workplace, city) => {
    expect(readCity(workplace)).toBe(city);
  });

  it('has no city without a place d’affectation', () => {
    expect(readCity(null)).toBeNull();
  });
});
