import { describe, expect, it } from 'vitest';

import { readRubriques, writeRubriques } from './faits.ts';

// faits.md as jf profil writes it, with what the form cannot read: free text and a rubrique of its own
const FAITS = `# Faits

Validés par Léa le 12 octobre.

## Identité

Léa Martin, née le 3 mars 2001

## Diplômes

- Master 2 droit privé, Université de Lille, 2025
- Licence de droit, Université d'Artois, 2023

## Stages

- Cabinet Dupont, Arras, été 2024

## Expériences

- Assistante juridique, Cabinet Martin, Lille, 2025-2026
  - Rédaction de conclusions
  - Suivi des audiences

## Mobilité

Lille, Arras et Béthune
`;

function entryListByTitle(markdown: string) {
  return Object.fromEntries(readRubriques(markdown).map(({ title, entryList }) => [title, entryList]));
}

describe('rubriques of faits.md', () => {
  it('reads each rubrique of the form, in the order of the form, a list as its entries', () => {
    expect(readRubriques(FAITS)).toEqual([
      { title: 'Identité', isList: false, entryList: ['Léa Martin, née le 3 mars 2001'] },
      { title: 'Coordonnées', isList: false, entryList: [''] },
      {
        title: 'Diplômes',
        isList: true,
        entryList: ['Master 2 droit privé, Université de Lille, 2025', "Licence de droit, Université d'Artois, 2023"],
      },
      {
        title: 'Expériences',
        isList: true,
        entryList: [
          'Assistante juridique, Cabinet Martin, Lille, 2025-2026\n- Rédaction de conclusions\n- Suivi des audiences',
        ],
      },
      { title: 'Compétences', isList: false, entryList: [''] },
      { title: 'Motivations', isList: false, entryList: [''] },
      { title: 'Mobilité', isList: false, entryList: ['Lille, Arras et Béthune'] },
    ]);
  });

  it('writes back what it read without changing a byte', () => {
    expect(writeRubriques(FAITS, readRubriques(FAITS))).toBe(FAITS);
  });
});

describe('rubriques of faits.md, written', () => {
  it('rewrites the rubrique modified and leaves the rest of the file as written', () => {
    const rubriqueList = readRubriques(FAITS).map((rubrique) =>
      rubrique.title === 'Mobilité' ? { ...rubrique, entryList: ['Toute la région Hauts-de-France'] } : rubrique,
    );

    expect(writeRubriques(FAITS, rubriqueList)).toBe(
      FAITS.replace('Lille, Arras et Béthune', 'Toute la région Hauts-de-France'),
    );
  });

  it('adds, modifies and removes the entries of a list, an entry of several lines indented under its item', () => {
    const markdown = writeRubriques(FAITS, [
      ...readRubriques(FAITS).filter(({ title }) => title !== 'Expériences' && title !== 'Diplômes'),
      { title: 'Diplômes', entryList: ['Master 2 droit privé, Université de Lille, 2025', '  ', 'CRFPA, 2026'] },
      { title: 'Expériences', entryList: ['Juriste, Mairie de Lens, 2026\n- Marchés publics'] },
    ]);

    expect(markdown).toContain(
      '## Diplômes\n\n- Master 2 droit privé, Université de Lille, 2025\n- CRFPA, 2026\n\n## Stages',
    );
    expect(markdown).toContain('## Expériences\n\n- Juriste, Mairie de Lens, 2026\n  - Marchés publics\n\n## Mobilité');
    expect(entryListByTitle(markdown)['Expériences']).toEqual(['Juriste, Mairie de Lens, 2026\n- Marchés publics']);
  });

  it('adds an absent rubrique before the next rubrique of the form, and an empty one not at all', () => {
    const markdown = writeRubriques(FAITS, [
      ...readRubriques(FAITS).filter(({ title }) => title !== 'Coordonnées' && title !== 'Motivations'),
      { title: 'Coordonnées', entryList: ['lea.martin@example.org'] },
      { title: 'Motivations', entryList: ['  '] },
    ]);

    expect(markdown).toContain(
      'Léa Martin, née le 3 mars 2001\n\n## Coordonnées\n\nlea.martin@example.org\n\n## Diplômes',
    );
    expect(markdown).not.toContain('## Motivations');
  });

  it('adds a rubrique after the others when no rubrique of the form follows it', () => {
    const markdown = writeRubriques('# Faits\n\n## Diplômes\n\n- Master 2', [
      { title: 'Diplômes', entryList: ['Master 2'] },
      { title: 'Mobilité', entryList: ['Lille'] },
    ]);

    expect(markdown).toBe('# Faits\n\n## Diplômes\n\n- Master 2\n\n## Mobilité\n\nLille\n');
  });

  it('keeps the free text of a list rubrique, before its first item', () => {
    const markdown = '# Faits\n\n## Diplômes\n\nTous obtenus avec mention.\n\n- Master 2\n';

    expect(writeRubriques(markdown, [{ title: 'Diplômes', entryList: ['Master 2', 'Licence'] }])).toBe(
      '# Faits\n\n## Diplômes\n\nTous obtenus avec mention.\n\n- Master 2\n- Licence\n',
    );
  });

  it('finds a rubrique whatever its case and accents, and keeps its heading', () => {
    const markdown = '# Faits\n\n## experiences\n\n- Stage\n';

    expect(entryListByTitle(markdown)['Expériences']).toEqual(['Stage']);
    expect(writeRubriques(markdown, [{ title: 'Expériences', entryList: ['Stage', 'CDD'] }])).toBe(
      '# Faits\n\n## experiences\n\n- Stage\n- CDD\n',
    );
  });

  it('reads a rubrique whose heading ends the file as empty', () => {
    expect(entryListByTitle('# Faits\n\n## Mobilité')['Mobilité']).toEqual(['']);
  });

  it('creates faits.md when the Profil has none', () => {
    expect(writeRubriques('', [{ title: 'Identité', entryList: ['Camille Durand'] }])).toBe(
      '# Faits\n\n## Identité\n\nCamille Durand\n',
    );
  });
});

describe('rubriques of faits.md, what the form does not show', () => {
  it('keeps the spacing of the sections it does not rewrite', () => {
    const markdown = '# Faits\n## Diplômes\n- Master 2\n\n\n\n## Stages\n- Cabinet Dupont\n## Mobilité\nLille\n';

    const rubriqueList = readRubriques(markdown).map((rubrique) =>
      rubrique.title === 'Mobilité' ? { ...rubrique, entryList: ['Arras'] } : rubrique,
    );

    expect(writeRubriques(markdown, rubriqueList)).toBe(
      '# Faits\n## Diplômes\n- Master 2\n\n\n\n## Stages\n- Cabinet Dupont\n\n## Mobilité\n\nArras\n',
    );
  });

  it('keeps a paragraph after the list of a list rubrique out of its last entry', () => {
    const markdown = '# Faits\n\n## Diplômes\n\n- Master 2\n\nTous obtenus avec mention.\n';

    expect(entryListByTitle(markdown)['Diplômes']).toEqual(['Master 2']);
    expect(writeRubriques(markdown, [{ title: 'Diplômes', entryList: ['Master 2', 'Licence'] }])).toBe(
      '# Faits\n\n## Diplômes\n\n- Master 2\n- Licence\n\nTous obtenus avec mention.\n',
    );
  });
});
