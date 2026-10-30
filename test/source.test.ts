import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory, createMigratedDataDirectory } from './data-directory.ts';
import { createRecordedFetch } from './recorded-http.ts';

// A data folder where Léa has a single Veille, imported from the config an older jf left (ADR-0011):
// the front would refuse it, but a Source may also leave the registry
function createDataDirectoryWith(veille: object): string {
  const dataDirectory = createMigratedDataDirectory();
  const config = { defaultDelayMonths: 6, candidateList: [{ id: 'lea', name: 'Léa', veilleList: [veille] }] };
  writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify(config));
  return dataDirectory;
}

describe('the Sources a Veille follows', () => {
  // The form of a Veille builds its fields from them, as that of the Canal de notification (ADR-0010)
  it('describes each Source with the Paramètres a Veille gives it, the Zone among them', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    const sourceList = await actions.listSources();

    expect(sourceList.filter(({ id }) => id === 'pep')).toEqual([
      {
        id: 'pep',
        name: 'Place de l’Emploi Public',
        parametreList: [
          {
            name: 'title',
            label: 'Titre recherché',
            placeholder: 'attaché de justice',
            type: 'text',
            isRequired: true,
            isSecret: false,
            hasChoices: false,
          },
          {
            name: 'courtOfAppealList',
            label: 'Cours d’appel de la Zone',
            placeholder: 'Douai',
            type: 'list',
            isRequired: true,
            isSecret: false,
            hasChoices: false,
          },
        ],
      },
    ]);
  });

  // The real data/config.json predates the Paramètres of a Veille: it needs no rewrite
  it('reads a Veille of an older config, its criteria and Zone as the Paramètres of its Source', async () => {
    const dataDirectory = createDataDirectoryWith({
      id: 'attache-de-justice-hauts-de-france',
      source: 'pep',
      criteria: { title: 'attaché de justice' },
      zone: { courtOfAppealList: ['Douai', 'Amiens'] },
    });
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });

    await actions.detect();

    const offreList = await actions.listOffres({ candidateId: 'lea' });
    expect(offreList.filter(({ isInZone }) => isInZone).map(({ reference }) => reference)).toContain('2026-2445600');
  });

  it('stops the Détection of a Veille that follows an unknown Source, naming those it may follow', async () => {
    const dataDirectory = createDataDirectoryWith({ id: 'ailleurs', source: 'inconnue', parametres: {} });
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });

    await expect(actions.detect()).rejects.toThrow(
      'Source inconnue pour la Veille ailleurs : inconnue. En choisir une parmi pep dans les Veilles du Profil.',
    );
  });

  it('stops the Détection of a Veille whose Paramètres its Source refuses, naming them as the form does', async () => {
    const dataDirectory = createDataDirectoryWith({
      id: 'sans-zone',
      source: 'pep',
      parametres: { title: 'attaché de justice', courtOfAppealList: [] },
    });
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });

    await expect(actions.detect()).rejects.toThrow(
      "La Veille sans-zone ne donne pas à la Source Place de l’Emploi Public les Paramètres qu'elle attend : corriger « Cours d’appel de la Zone »",
    );
  });
});
