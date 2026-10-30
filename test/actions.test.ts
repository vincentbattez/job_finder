import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { writeOlderDatabase } from './older-database.ts';
import { migrateDeploy } from './prisma-cli.ts';

function createEmptyDataDirectory(): string {
  return mkdtempSync(path.join(tmpdir(), 'job-finder-'));
}

function writeConfig(dataDirectory: string, config: object): void {
  writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify(config));
}

const LEA_CONFIG = { id: 'lea', name: 'Léa', watchList: [] };

const FIRST_MIGRATION = '20261029133617_init';
// The last migration before the Notification Channels, which turned each Home Assistant connection
// into one (ADR-0010)
const HOME_ASSISTANT_CONNECTION_MIGRATION = '20261030090736_job_profil';
// The last migration before the Sources became a family, which gathered the criteria and the Zone of
// each Watch into its Parameters (ADR-0010)
const NOTIFICATION_CHANNEL_MIGRATION = '20261030110155_canal_notification';
// The last migration before the row of the settings became that of the Default Deadline Period
const SETTINGS_MIGRATION = '20261030114047_settings';

function listLeaProfileFiles(dataDirectory: string): string[] {
  return readdirSync(path.join(dataDirectory, 'candidates', 'lea', 'profile'));
}

describe('actions', () => {
  it('lists the Candidates', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa', locale: 'fr' }]);
  });

  it('gives each Candidate an empty Profile folder on first launch', async () => {
    const dataDirectory = createDataDirectory();

    await createActions({ dataDirectory });

    expect(listLeaProfileFiles(dataDirectory)).toEqual([]);
  });

  it('keeps the existing Profile and Candidates when launched again', async () => {
    const dataDirectory = createDataDirectory();
    await createActions({ dataDirectory });
    writeFileSync(path.join(dataDirectory, 'candidates', 'lea', 'profile', 'facts.md'), '# Faits\n');

    const actions = await createActions({ dataDirectory });

    expect(listLeaProfileFiles(dataDirectory)).toEqual(['facts.md']);
    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa', locale: 'fr' }]);
  });

  // The real data/ comes with the config the older jf read: it is imported too (ADR-0011)
  it('brings the database an older jf left up to date', async () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidateList: [LEA_CONFIG] });
    writeOlderDatabase(dataDirectory, FIRST_MIGRATION);

    const actions = await createActions({ dataDirectory });

    // The Notification Channels came with a later migration
    expect(await actions.readNotificationChannel({ candidateId: 'lea' })).toEqual({
      module: null,
      parameters: {},
      configuredSecretList: [],
    });
  });

  // The main checkout migrates the real data/: Léa keeps her connection, nothing to type again
  it('turns the Home Assistant connection of each Candidate into their Notification Channel, without loss', async () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidateList: [LEA_CONFIG] });
    const database = new DatabaseSync(writeOlderDatabase(dataDirectory, HOME_ASSISTANT_CONNECTION_MIGRATION));
    database.exec(`INSERT INTO Candidat (id, name) VALUES ('lea', 'Léa');
      INSERT INTO ConnexionHomeAssistant (candidatId, url, token, service)
      VALUES ('lea', 'https://domotique.example', 'jeton-de-lea', 'notify.mobile_app_iphone_de_lea');`);
    database.close();

    const actions = await createActions({ dataDirectory });

    expect(await actions.readNotificationChannel({ candidateId: 'lea' })).toEqual({
      module: 'home-assistant',
      parameters: { url: 'https://domotique.example', service: 'notify.mobile_app_iphone_de_lea' },
      configuredSecretList: ['token'],
    });
    const migrated = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { readOnly: true });
    expect(
      migrated.prepare("SELECT json_extract(parameters, '$.token') AS token FROM NotificationChannel").get(),
    ).toEqual({
      token: 'jeton-de-lea',
    });
    migrated.close();
  });

  // The main checkout migrates the real data/: each Watch keeps its Parameters and its first launch
  // stays over, so the next Detection triggers as before
  it('gathers the criteria and the Zone of each Watch into the Parameters of its Source, without loss', () => {
    const dataDirectory = createEmptyDataDirectory();
    const databasePath = writeOlderDatabase(dataDirectory, NOTIFICATION_CHANNEL_MIGRATION);
    const database = new DatabaseSync(databasePath);
    database.exec(`INSERT INTO Candidat (id, name) VALUES ('lea', 'Léa');
      INSERT INTO Veille (id, candidatId, source, criteria, zone, detectedAt)
      VALUES ('attache-de-justice-hauts-de-france', 'lea', 'pep', '{"title":"attaché de justice"}',
        '{"courtOfAppealList":["Douai","Amiens"]}', '2026-10-30T10:44:22.500+00:00');`);
    database.close();

    migrateDeploy(databasePath);

    const migrated = new DatabaseSync(databasePath, { readOnly: true });
    expect(migrated.prepare('SELECT id, candidateId, source, parameters, detectedAt FROM Watch').all()).toEqual([
      {
        id: 'attache-de-justice-hauts-de-france',
        candidateId: 'lea',
        source: 'pep',
        parameters: '{"title":"attaché de justice","courtOfAppealList":["Douai","Amiens"]}',
        detectedAt: '2026-10-30T10:44:22.500+00:00',
      },
    ]);
    migrated.close();
  });

  // The main checkout migrates the real data/: the Default Deadline Period stays, and so does the mark that
  // the config was imported, which is never read again
  it('keeps the Default Deadline Period of the settings, and the import over', async () => {
    const dataDirectory = createEmptyDataDirectory();
    const database = new DatabaseSync(writeOlderDatabase(dataDirectory, SETTINGS_MIGRATION));
    database.exec(`INSERT INTO Settings (id, defaultDelayMonths) VALUES (1, 7);`);
    database.close();
    writeConfig(dataDirectory, { defaultDelayMonths: 2, candidateList: [LEA_CONFIG] });

    const actions = await createActions({ dataDirectory });

    expect(await actions.readDefaultDeadlinePeriod()).toEqual({ months: 7 });
    expect(await actions.listCandidates()).toEqual([]);
  });

  it('refuses to list the Postings of an unknown Candidate', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.listPostings({ candidateId: 'inconnu' })).rejects.toThrow(/Candidat inconnu : inconnu/);
  });

  it('starts in an empty data folder, creating its database, without any config', async () => {
    const actions = await createActions({ dataDirectory: createEmptyDataDirectory() });

    expect(await actions.listCandidates()).toEqual([]);
  });
});
