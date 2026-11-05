import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory, createMigratedDataDirectory } from './data-directory.ts';
import { createRecordedFetch } from './recorded-http.ts';

// A data folder where Léa has a single Watch, imported from the config an older jf left (ADR-0011):
// the front would refuse it, but a Source may also leave the registry
function createDataDirectoryWith(watch: object): string {
  const dataDirectory = createMigratedDataDirectory();
  const config = { defaultDelayMonths: 6, candidateList: [{ id: 'lea', name: 'Léa', watchList: [watch] }] };
  writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify(config));
  return dataDirectory;
}

describe('the Sources a Watch follows', () => {
  // The form of a Watch builds its fields from them, as that of the Notification Channel (ADR-0010)
  // The Zone is gone with its courts of appeal (ADR-0018)
  it('describes each Source with the Parameters a Watch gives it', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    const sourceList = await actions.listSources();

    expect(sourceList.filter(({ id }) => id === 'pep')).toEqual([
      {
        id: 'pep',
        name: 'Place de l’Emploi Public',
        parameterList: [
          {
            name: 'title',
            label: 'sourcePep:titleLabel',
            placeholder: 'sourcePep:titlePlaceholder',
            type: 'text',
            isRequired: true,
            isSecret: false,
            hasChoices: false,
          },
        ],
      },
    ]);
  });

  // The real data/config.json predates the Parameters of a Watch: it needs no rewrite
  it('reads a Watch of an older config, its criteria as the Parameters of its Source, its Zone dropped', async () => {
    const dataDirectory = createDataDirectoryWith({
      id: 'attache-de-justice-hauts-de-france',
      source: 'pep',
      criteria: { title: 'attaché de justice' },
      zone: { courtOfAppealList: ['Douai', 'Amiens'] },
    });
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });

    expect(await actions.listWatches({ candidateId: 'lea' })).toMatchObject([
      { parameters: { title: 'attaché de justice' } },
    ]);
    await actions.detect();

    const postingList = await actions.listPostings({ candidateId: 'lea' });
    expect(postingList.map(({ reference }) => reference)).toContain('2026-2445600');
  });

  it('stops the Detection of a Watch that follows an unknown Source, naming those it may follow', async () => {
    const dataDirectory = createDataDirectoryWith({ id: 'ailleurs', source: 'inconnue', parameters: {} });
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });

    await expect(actions.detect()).rejects.toThrow(
      'Source inconnue pour la Veille ailleurs : inconnue. En choisir une parmi pep sur la page des Veilles.',
    );
  });

  it('stops the Detection of a Watch whose Parameters its Source refuses, naming them as the form does', async () => {
    const dataDirectory = createDataDirectoryWith({
      id: 'sans-titre',
      source: 'pep',
      parameters: { title: '' },
    });
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });

    await expect(actions.detect()).rejects.toThrow(
      "La Veille sans-titre ne donne pas à la Source Place de l’Emploi Public les Paramètres qu'elle attend : corriger « Titre recherché »",
    );
  });
});
