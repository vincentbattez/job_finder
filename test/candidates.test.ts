import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory, createMigratedDataDirectory } from './data-directory.ts';
import { createRecordedFetch } from './recorded-http.ts';

// The config an older jf read at every launch, as the real data/config.json still writes its Watch
const OLDER_CONFIG = {
  defaultDelayMonths: 4,
  candidateList: [
    {
      id: 'lea',
      name: 'Léa',
      watchList: [
        {
          id: 'attache-de-justice-hauts-de-france',
          source: 'pep',
          criteria: { title: 'attaché de justice' },
          zone: { courtOfAppealList: ['Douai', 'Amiens'] },
        },
      ],
    },
    { id: 'camille', name: 'Camille', watchList: [] },
  ],
};

function writeConfig(dataDirectory: string, config: object): string {
  const configPath = path.join(dataDirectory, 'config.json');
  writeFileSync(configPath, JSON.stringify(config));
  return configPath;
}

describe('Candidates', () => {
  it('starts without a config, with no Candidate and a Default Deadline Period of 6 months', async () => {
    const actions = await createActions({ dataDirectory: createMigratedDataDirectory() });

    expect(await actions.listCandidates()).toEqual([]);
    expect(await actions.readDefaultDeadlinePeriod()).toEqual({ months: 6 });
    expect(await actions.findObsoleteConfig()).toEqual({ path: null });
  });

  it('creates a Candidate from the front, with their Profile folder', async () => {
    const dataDirectory = createDataDirectory();
    const actions = await createActions({ dataDirectory });

    await actions.createCandidate({ id: 'jean-pierre', name: ' Jean-Pierre ' });

    expect(await actions.listCandidates()).toEqual([
      { id: 'jean-pierre', name: 'Jean-Pierre', locale: 'fr' },
      { id: 'lea', name: 'Léa', locale: 'fr' },
    ]);
    expect(await actions.listProfileFiles({ candidateId: 'jean-pierre' })).toEqual([]);
    expect(existsSync(path.join(dataDirectory, 'candidates', 'jean-pierre', 'profile'))).toBe(true);
  });

  // French by default, as Léa reads it: the switcher of the front changes it later
  it('creates a Candidate who reads the interface in English', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await actions.createCandidate({ id: 'emma', name: 'Emma', locale: 'en' });

    expect(await actions.listCandidates()).toEqual([
      { id: 'emma', name: 'Emma', locale: 'en' },
      { id: 'lea', name: 'Léa', locale: 'fr' },
    ]);
  });

  it('refuses a Candidate whose identifier another one has', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.createCandidate({ id: 'lea', name: 'Léa bis' })).rejects.toThrow(
      "Un Candidat a déjà l'identifiant lea : en choisir un autre.",
    );
    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa', locale: 'fr' }]);
  });

  it.each(['Léa', '../lea', 'lea jean', ''])(
    'refuses the identifier « %s », which would not name a folder',
    async (id) => {
      const actions = await createActions({ dataDirectory: createDataDirectory() });

      await expect(actions.createCandidate({ id, name: 'Léa' })).rejects.toThrow(
        `« ${id} » n'est pas un identifiant de Candidat`,
      );
    },
  );

  it('refuses a Candidate without a name', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.createCandidate({ id: 'camille', name: '  ' })).rejects.toThrow(
      'Le nom du Candidat est vide : le renseigner.',
    );
  });

  it('renames a Candidate, who keeps their identifier', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await actions.renameCandidate({ candidateId: 'lea', name: 'Léa Martin' });

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa Martin', locale: 'fr' }]);
  });

  // The switcher of the front: the CLI and the notifications follow the locale it saves
  it("saves the locale a Candidate chose, and refuses one the front doesn't offer", async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await actions.setCandidateLocale({ candidateId: 'lea', locale: 'en' });

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa', locale: 'en' }]);
    await expect(actions.setCandidateLocale({ candidateId: 'lea', locale: 'de' })).rejects.toThrow();
    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa', locale: 'en' }]);
  });
});

// The real data/ has a config an older jf read at every launch: it is imported once, then never read
// again (ADR-0011)
describe('the config an older jf left', () => {
  it('is imported at the first launch: its Candidates, their Watches and the Default Deadline Period', async () => {
    const dataDirectory = createMigratedDataDirectory();
    const configPath = writeConfig(dataDirectory, OLDER_CONFIG);

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidates()).toEqual([
      { id: 'camille', name: 'Camille', locale: 'fr' },
      { id: 'lea', name: 'Léa', locale: 'fr' },
    ]);
    expect(await actions.listWatches({ candidateId: 'lea' })).toEqual([
      {
        id: 'attache-de-justice-hauts-de-france',
        candidateId: 'lea',
        source: 'pep',
        parameters: { title: 'attaché de justice' },
        detectedAt: null,
        label: 'attaché de justice',
        nearMissList: [],
      },
    ]);
    // Left in place, but no longer read: jf says so until it is deleted
    expect(await actions.readDefaultDeadlinePeriod()).toEqual({ months: 4 });
    expect(await actions.findObsoleteConfig()).toEqual({ path: configPath });
  });

  it('gives each Candidate the locale it names, French otherwise', async () => {
    const dataDirectory = createMigratedDataDirectory();
    writeConfig(dataDirectory, {
      ...OLDER_CONFIG,
      candidateList: [...OLDER_CONFIG.candidateList, { id: 'emma', name: 'Emma', locale: 'en', watchList: [] }],
    });

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidates()).toEqual([
      { id: 'camille', name: 'Camille', locale: 'fr' },
      { id: 'emma', name: 'Emma', locale: 'en' },
      { id: 'lea', name: 'Léa', locale: 'fr' },
    ]);
  });

  it('is never read again, so what the front set stays', async () => {
    const dataDirectory = createMigratedDataDirectory();
    writeConfig(dataDirectory, OLDER_CONFIG);
    const frontActions = await createActions({ dataDirectory });
    await frontActions.renameCandidate({ candidateId: 'lea', name: 'Léa Martin' });
    await frontActions.saveDefaultDeadlinePeriod({ months: 8 });
    await frontActions.deleteWatch({ candidateId: 'lea', watchId: 'attache-de-justice-hauts-de-france' });
    writeConfig(dataDirectory, {
      ...OLDER_CONFIG,
      defaultDelayMonths: 2,
      candidateList: [{ id: 'noe', name: 'Noé', watchList: [] }],
    });

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidates()).toEqual([
      { id: 'camille', name: 'Camille', locale: 'fr' },
      { id: 'lea', name: 'Léa Martin', locale: 'fr' },
    ]);
    expect(await actions.listWatches({ candidateId: 'lea' })).toEqual([]);
    expect(await actions.readDefaultDeadlinePeriod()).toEqual({ months: 8 });
  });

  it('is never read again once invalid either, once the Default Deadline Period exists', async () => {
    const dataDirectory = createDataDirectory();
    writeConfig(dataDirectory, { candidateList: 'invalide' });

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa', locale: 'fr' }]);
  });

  it('refuses the first launch while invalid, naming the faulty field', async () => {
    const dataDirectory = createMigratedDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidateList: [{ id: 'lea' }] });

    await expect(createActions({ dataDirectory })).rejects.toThrow(/candidateList\[0\]\.name/);
  });

  // The real data/ already holds the Watches an older jf copied from its config at every launch, each
  // past its first launch: the next Detection notifies a new Posting as before, and duplicates none
  it('keeps when each Watch last went through, so the next Detection goes on as before', async () => {
    const dataDirectory = createMigratedDataDirectory();
    writeConfig(dataDirectory, OLDER_CONFIG);
    const firstActions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await firstActions.detect();
    const postingList = await firstActions.listPostings({ candidateId: 'lea' });
    // As if the database had been there before the import, the Watch past its first launch
    const database = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'));
    database.exec('DELETE FROM DefaultDeadlinePeriod');
    database.close();

    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });

    const [watch] = await actions.listWatches({ candidateId: 'lea' });
    expect(watch?.detectedAt).toBeInstanceOf(Date);
    expect(await actions.detect()).toMatchObject([
      { watchId: 'attache-de-justice-hauts-de-france', isFirstLaunch: false, newPostingList: [] },
    ]);
    expect(await actions.listPostings({ candidateId: 'lea' })).toEqual(postingList);
  });
});
