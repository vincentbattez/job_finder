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

const LEA_CONFIG = { id: 'lea', name: 'Léa', veilleList: [] };

const FIRST_MIGRATION = '20261029133617_init';
// The last migration before the Canaux de notification, which turned each Connexion Home Assistant
// into one (ADR-0010)
const CONNEXION_HOME_ASSISTANT_MIGRATION = '20261030090736_job_profil';
// The last migration before the Sources became a family, which gathered the criteria and the Zone of
// each Veille into its Paramètres (ADR-0010)
const CANAL_NOTIFICATION_MIGRATION = '20261030110155_canal_notification';
// The last migration before the row of the settings became that of the Délai par défaut
const SETTINGS_MIGRATION = '20261030114047_settings';

function listLeaProfileFiles(dataDirectory: string): string[] {
  return readdirSync(path.join(dataDirectory, 'candidates', 'lea', 'profile'));
}

describe('actions', () => {
  it('lists the Candidates', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa' }]);
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
    expect(await actions.listCandidates()).toEqual([{ id: 'lea', name: 'Léa' }]);
  });

  // The real data/ comes with the config the older jf read: it is imported too (ADR-0011)
  it('brings the database an older jf left up to date', async () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidateList: [LEA_CONFIG] });
    writeOlderDatabase(dataDirectory, FIRST_MIGRATION);

    const actions = await createActions({ dataDirectory });

    // The Canaux de notification came with a later migration
    expect(await actions.readCanalNotification({ candidateId: 'lea' })).toEqual({
      module: null,
      parametres: {},
      configuredSecretList: [],
    });
  });

  // The main checkout migrates the real data/: Léa keeps her Connexion, nothing to type again
  it('turns the Connexion Home Assistant of each Candidate into their Canal de notification, without loss', async () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidateList: [LEA_CONFIG] });
    const database = new DatabaseSync(writeOlderDatabase(dataDirectory, CONNEXION_HOME_ASSISTANT_MIGRATION));
    database.exec(`INSERT INTO Candidat (id, name) VALUES ('lea', 'Léa');
      INSERT INTO ConnexionHomeAssistant (candidatId, url, token, service)
      VALUES ('lea', 'https://domotique.example', 'jeton-de-lea', 'notify.mobile_app_iphone_de_lea');`);
    database.close();

    const actions = await createActions({ dataDirectory });

    expect(await actions.readCanalNotification({ candidateId: 'lea' })).toEqual({
      module: 'home-assistant',
      parametres: { url: 'https://domotique.example', service: 'notify.mobile_app_iphone_de_lea' },
      configuredSecretList: ['token'],
    });
    const migrated = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { readOnly: true });
    expect(
      migrated.prepare("SELECT json_extract(parametres, '$.token') AS token FROM CanalNotification").get(),
    ).toEqual({
      token: 'jeton-de-lea',
    });
    migrated.close();
  });

  // The main checkout migrates the real data/: each Veille keeps its Paramètres and its first launch
  // stays over, so the next Détection triggers as before
  it('gathers the criteria and the Zone of each Veille into the Paramètres of its Source, without loss', () => {
    const dataDirectory = createEmptyDataDirectory();
    const databasePath = writeOlderDatabase(dataDirectory, CANAL_NOTIFICATION_MIGRATION);
    const database = new DatabaseSync(databasePath);
    database.exec(`INSERT INTO Candidat (id, name) VALUES ('lea', 'Léa');
      INSERT INTO Veille (id, candidatId, source, criteria, zone, detectedAt)
      VALUES ('attache-de-justice-hauts-de-france', 'lea', 'pep', '{"title":"attaché de justice"}',
        '{"courtOfAppealList":["Douai","Amiens"]}', '2026-10-30T10:44:22.500+00:00');`);
    database.close();

    migrateDeploy(databasePath);

    const migrated = new DatabaseSync(databasePath, { readOnly: true });
    expect(migrated.prepare('SELECT id, candidateId, source, parametres, detectedAt FROM Veille').all()).toEqual([
      {
        id: 'attache-de-justice-hauts-de-france',
        candidateId: 'lea',
        source: 'pep',
        parametres: '{"title":"attaché de justice","courtOfAppealList":["Douai","Amiens"]}',
        detectedAt: '2026-10-30T10:44:22.500+00:00',
      },
    ]);
    migrated.close();
  });

  // The main checkout migrates the real data/: the Délai par défaut stays, and so does the mark that
  // the config was imported, which is never read again
  it('keeps the Délai par défaut of the settings, and the import over', async () => {
    const dataDirectory = createEmptyDataDirectory();
    const database = new DatabaseSync(writeOlderDatabase(dataDirectory, SETTINGS_MIGRATION));
    database.exec(`INSERT INTO Settings (id, defaultDelayMonths) VALUES (1, 7);`);
    database.close();
    writeConfig(dataDirectory, { defaultDelayMonths: 2, candidateList: [LEA_CONFIG] });

    const actions = await createActions({ dataDirectory });

    expect(await actions.readDelaiParDefaut()).toEqual({ months: 7 });
    expect(await actions.listCandidates()).toEqual([]);
  });

  it('refuses to list the Offres of an unknown Candidate', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.listOffres({ candidateId: 'inconnu' })).rejects.toThrow(/Candidat inconnu : inconnu/);
  });

  it('starts in an empty data folder, creating its database, without any config', async () => {
    const actions = await createActions({ dataDirectory: createEmptyDataDirectory() });

    expect(await actions.listCandidates()).toEqual([]);
  });
});
