import { describe, expect, it } from 'vitest';

import { readSections, writeSections } from './facts.ts';

// facts.md as jf profile writes it, with what the form cannot read: free text and a section of its own
const FACTS = `# Faits

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
  return Object.fromEntries(readSections(markdown).map(({ title, entryList }) => [title, entryList]));
}

describe('sections of facts.md', () => {
  it('reads each section of the form, in the order of the form, a list as its entries', () => {
    expect(readSections(FACTS)).toMatchObject([
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
    expect(writeSections(FACTS, readSections(FACTS))).toBe(FACTS);
  });
});

describe('sections of facts.md, written', () => {
  it('rewrites the section modified and leaves the rest of the file as written', () => {
    const sectionList = readSections(FACTS).map((section) =>
      section.title === 'Mobilité' ? { ...section, entryList: ['Toute la région Hauts-de-France'] } : section,
    );

    expect(writeSections(FACTS, sectionList)).toBe(
      FACTS.replace('Lille, Arras et Béthune', 'Toute la région Hauts-de-France'),
    );
  });

  it('adds, modifies and removes the entries of a list, an entry of several lines indented under its item', () => {
    const markdown = writeSections(FACTS, [
      ...readSections(FACTS).filter(({ title }) => title !== 'Expériences' && title !== 'Diplômes'),
      { title: 'Diplômes', entryList: ['Master 2 droit privé, Université de Lille, 2025', '  ', 'CRFPA, 2026'] },
      { title: 'Expériences', entryList: ['Juriste, Mairie de Lens, 2026\n- Marchés publics'] },
    ]);

    expect(markdown).toContain(
      '## Diplômes\n\n- Master 2 droit privé, Université de Lille, 2025\n- CRFPA, 2026\n\n## Stages',
    );
    expect(markdown).toContain('## Expériences\n\n- Juriste, Mairie de Lens, 2026\n  - Marchés publics\n\n## Mobilité');
    expect(entryListByTitle(markdown)['Expériences']).toEqual(['Juriste, Mairie de Lens, 2026\n- Marchés publics']);
  });

  it('adds an absent section before the next section of the form, and an empty one not at all', () => {
    const markdown = writeSections(FACTS, [
      ...readSections(FACTS).filter(({ title }) => title !== 'Coordonnées' && title !== 'Motivations'),
      { title: 'Coordonnées', entryList: ['lea.martin@example.org'] },
      { title: 'Motivations', entryList: ['  '] },
    ]);

    expect(markdown).toContain(
      'Léa Martin, née le 3 mars 2001\n\n## Coordonnées\n\nlea.martin@example.org\n\n## Diplômes',
    );
    expect(markdown).not.toContain('## Motivations');
  });

  it('adds a section after the others when no section of the form follows it', () => {
    const markdown = writeSections('# Faits\n\n## Diplômes\n\n- Master 2', [
      { title: 'Diplômes', entryList: ['Master 2'] },
      { title: 'Mobilité', entryList: ['Lille'] },
    ]);

    expect(markdown).toBe('# Faits\n\n## Diplômes\n\n- Master 2\n\n## Mobilité\n\nLille\n');
  });

  it('keeps the free text of a list section, before its first item', () => {
    const markdown = '# Faits\n\n## Diplômes\n\nTous obtenus avec mention.\n\n- Master 2\n';

    expect(writeSections(markdown, [{ title: 'Diplômes', entryList: ['Master 2', 'Licence'] }])).toBe(
      '# Faits\n\n## Diplômes\n\nTous obtenus avec mention.\n\n- Master 2\n- Licence\n',
    );
  });

  it('finds a section whatever its case and accents, and keeps its heading', () => {
    const markdown = '# Faits\n\n## experiences\n\n- Stage\n';

    expect(entryListByTitle(markdown)['Expériences']).toEqual(['Stage']);
    expect(writeSections(markdown, [{ title: 'Expériences', entryList: ['Stage', 'CDD'] }])).toBe(
      '# Faits\n\n## experiences\n\n- Stage\n- CDD\n',
    );
  });

  it('reads a section whose heading ends the file as empty', () => {
    expect(entryListByTitle('# Faits\n\n## Mobilité')['Mobilité']).toEqual(['']);
  });

  it('creates facts.md when the Profile has none', () => {
    expect(writeSections('', [{ title: 'Identité', entryList: ['Camille Durand'] }])).toBe(
      '# Faits\n\n## Identité\n\nCamille Durand\n',
    );
  });
});

describe('sections of facts.md, what the form does not show', () => {
  it('keeps the spacing of the sections it does not rewrite', () => {
    const markdown = '# Faits\n## Diplômes\n- Master 2\n\n\n\n## Stages\n- Cabinet Dupont\n## Mobilité\nLille\n';

    const sectionList = readSections(markdown).map((section) =>
      section.title === 'Mobilité' ? { ...section, entryList: ['Arras'] } : section,
    );

    expect(writeSections(markdown, sectionList)).toBe(
      '# Faits\n## Diplômes\n- Master 2\n\n\n\n## Stages\n- Cabinet Dupont\n\n## Mobilité\n\nArras\n',
    );
  });

  it('keeps a paragraph after the list of a list section out of its last entry', () => {
    const markdown = '# Faits\n\n## Diplômes\n\n- Master 2\n\nTous obtenus avec mention.\n';

    expect(entryListByTitle(markdown)['Diplômes']).toEqual(['Master 2']);
    expect(writeSections(markdown, [{ title: 'Diplômes', entryList: ['Master 2', 'Licence'] }])).toBe(
      '# Faits\n\n## Diplômes\n\n- Master 2\n- Licence\n\nTous obtenus avec mention.\n',
    );
  });
});
