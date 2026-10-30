import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory, createMigratedDataDirectory } from './data-directory.ts';
import { createRecordedFetch } from './recorded-http.ts';

// The config an older jf read at every launch, as the real data/config.json still writes its Veille
const OLDER_CONFIG = {
  defaultDelayMonths: 4,
  candidatList: [
    {
      id: 'lea',
      name: 'Léa',
      veilleList: [
        {
          id: 'attache-de-justice-hauts-de-france',
          source: 'pep',
          criteria: { title: 'attaché de justice' },
          zone: { courtOfAppealList: ['Douai', 'Amiens'] },
        },
      ],
    },
    { id: 'camille', name: 'Camille', veilleList: [] },
  ],
};

function writeConfig(dataDirectory: string, config: object): string {
  const configPath = path.join(dataDirectory, 'config.json');
  writeFileSync(configPath, JSON.stringify(config));
  return configPath;
}

describe('Candidats', () => {
  it('starts without a config, with no Candidat and a Délai par défaut of 6 months', async () => {
    const actions = await createActions({ dataDirectory: createMigratedDataDirectory() });

    expect(await actions.listCandidats()).toEqual([]);
    expect(await actions.readDelaiParDefaut()).toEqual({ months: 6 });
    expect(await actions.findObsoleteConfig()).toEqual({ path: null });
  });

  it('creates a Candidat from the front, with their Profil folder', async () => {
    const dataDirectory = createDataDirectory();
    const actions = await createActions({ dataDirectory });

    await actions.createCandidat({ id: 'jean-pierre', name: ' Jean-Pierre ' });

    expect(await actions.listCandidats()).toEqual([
      { id: 'jean-pierre', name: 'Jean-Pierre' },
      { id: 'lea', name: 'Léa' },
    ]);
    expect(await actions.listProfilFiles({ candidatId: 'jean-pierre' })).toEqual([]);
    expect(existsSync(path.join(dataDirectory, 'candidats', 'jean-pierre', 'profil'))).toBe(true);
  });

  it('refuses a Candidat whose identifier another one has', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.createCandidat({ id: 'lea', name: 'Léa bis' })).rejects.toThrow(
      "Un Candidat a déjà l'identifiant lea : en choisir un autre.",
    );
    expect(await actions.listCandidats()).toEqual([{ id: 'lea', name: 'Léa' }]);
  });

  it.each(['Léa', '../lea', 'lea jean', ''])(
    'refuses the identifier « %s », which would not name a folder',
    async (id) => {
      const actions = await createActions({ dataDirectory: createDataDirectory() });

      await expect(actions.createCandidat({ id, name: 'Léa' })).rejects.toThrow(
        `« ${id} » n'est pas un identifiant de Candidat`,
      );
    },
  );

  it('refuses a Candidat without a name', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.createCandidat({ id: 'camille', name: '  ' })).rejects.toThrow(
      'Le nom du Candidat est vide : le renseigner.',
    );
  });

  it('renames a Candidat, who keeps their identifier', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await actions.renameCandidat({ candidatId: 'lea', name: 'Léa Martin' });

    expect(await actions.listCandidats()).toEqual([{ id: 'lea', name: 'Léa Martin' }]);
  });
});

// The real data/ has a config an older jf read at every launch: it is imported once, then never read
// again (ADR-0011)
describe('the config an older jf left', () => {
  it('is imported at the first launch: its Candidats, their Veilles and the Délai par défaut', async () => {
    const dataDirectory = createMigratedDataDirectory();
    const configPath = writeConfig(dataDirectory, OLDER_CONFIG);

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidats()).toEqual([
      { id: 'camille', name: 'Camille' },
      { id: 'lea', name: 'Léa' },
    ]);
    expect(await actions.listVeilles({ candidatId: 'lea' })).toEqual([
      {
        id: 'attache-de-justice-hauts-de-france',
        candidatId: 'lea',
        source: 'pep',
        parametres: { title: 'attaché de justice', courtOfAppealList: ['Douai', 'Amiens'] },
        detectedAt: null,
      },
    ]);
    // Left in place, but no longer read: jf says so until it is deleted
    expect(await actions.readDelaiParDefaut()).toEqual({ months: 4 });
    expect(await actions.findObsoleteConfig()).toEqual({ path: configPath });
  });

  it('is never read again, so what the front set stays', async () => {
    const dataDirectory = createMigratedDataDirectory();
    writeConfig(dataDirectory, OLDER_CONFIG);
    const frontActions = await createActions({ dataDirectory });
    await frontActions.renameCandidat({ candidatId: 'lea', name: 'Léa Martin' });
    await frontActions.saveDelaiParDefaut({ months: 8 });
    await frontActions.deleteVeille({ candidatId: 'lea', veilleId: 'attache-de-justice-hauts-de-france' });
    writeConfig(dataDirectory, {
      ...OLDER_CONFIG,
      defaultDelayMonths: 2,
      candidatList: [{ id: 'noe', name: 'Noé', veilleList: [] }],
    });

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidats()).toEqual([
      { id: 'camille', name: 'Camille' },
      { id: 'lea', name: 'Léa Martin' },
    ]);
    expect(await actions.listVeilles({ candidatId: 'lea' })).toEqual([]);
    expect(await actions.readDelaiParDefaut()).toEqual({ months: 8 });
  });

  it('is never read again once invalid either, once the Délai par défaut exists', async () => {
    const dataDirectory = createDataDirectory();
    writeConfig(dataDirectory, { candidatList: 'invalide' });

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidats()).toEqual([{ id: 'lea', name: 'Léa' }]);
  });

  it('refuses the first launch while invalid, naming the faulty field', async () => {
    const dataDirectory = createMigratedDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidatList: [{ id: 'lea' }] });

    await expect(createActions({ dataDirectory })).rejects.toThrow(/candidatList\[0\]\.name/);
  });

  // The real data/ already holds the Veilles an older jf copied from its config at every launch, each
  // past its first launch: the next Détection notifies a new Offre as before, and duplicates none
  it('keeps when each Veille last went through, so the next Détection goes on as before', async () => {
    const dataDirectory = createMigratedDataDirectory();
    writeConfig(dataDirectory, OLDER_CONFIG);
    const firstActions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await firstActions.detect();
    const offreList = await firstActions.listOffres({ candidatId: 'lea' });
    // As if the database had been there before the import, the Veille past its first launch
    const database = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'));
    database.exec('DELETE FROM DelaiParDefaut');
    database.close();

    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });

    const [veille] = await actions.listVeilles({ candidatId: 'lea' });
    expect(veille?.detectedAt).toBeInstanceOf(Date);
    expect(await actions.detect()).toMatchObject([
      { veilleId: 'attache-de-justice-hauts-de-france', isFirstLaunch: false, newOffreList: [] },
    ]);
    expect(await actions.listOffres({ candidatId: 'lea' })).toEqual(offreList);
  });
});
