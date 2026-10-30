import { cpSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { migrateDeploy } from './prisma-cli.ts';

function createEmptyDataDirectory(): string {
  return mkdtempSync(path.join(tmpdir(), 'job-finder-'));
}

function writeConfig(dataDirectory: string, config: object): void {
  writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify(config));
}

function candidatConfig(id: string, name: string): object {
  return { id, name, veilleList: [] };
}

const PRISMA_DIRECTORY = path.join(import.meta.dirname, '..', 'prisma');
const FIRST_MIGRATION = '20261029133617_init';
// The last migration before the Canaux de notification, which turned each Connexion Home Assistant
// into one (ADR-0010)
const CONNEXION_HOME_ASSISTANT_MIGRATION = '20261030090736_job_profil';
// The last migration before the Sources became a family, which gathered the criteria and the Zone of
// each Veille into its Paramètres (ADR-0010)
const CANAL_NOTIFICATION_MIGRATION = '20261030110155_canal_notification';

// The database an older jf left, migrated through a config that only knows the migrations up to the
// given one
function writeOlderDatabase(dataDirectory: string, lastMigration = FIRST_MIGRATION): string {
  const prismaDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-prisma-'));
  const migrationList = readdirSync(path.join(PRISMA_DIRECTORY, 'migrations')).filter(
    (fileName) => fileName <= lastMigration || fileName === 'migration_lock.toml',
  );
  for (const fileName of migrationList) {
    cpSync(path.join(PRISMA_DIRECTORY, 'migrations', fileName), path.join(prismaDirectory, 'migrations', fileName), {
      recursive: true,
    });
  }
  const databasePath = path.join(dataDirectory, 'job_finder.sqlite');
  const config = {
    schema: path.join(PRISMA_DIRECTORY, 'schema.prisma'),
    migrations: { path: path.join(prismaDirectory, 'migrations') },
    datasource: { url: `file:${databasePath}` },
  };
  const configPath = path.join(prismaDirectory, 'prisma.config.ts');
  writeFileSync(configPath, `export default ${JSON.stringify(config)};`);
  migrateDeploy(databasePath, configPath);
  return databasePath;
}

function listLeaProfilFiles(dataDirectory: string): string[] {
  return readdirSync(path.join(dataDirectory, 'candidats', 'lea', 'profil'));
}

describe('actions', () => {
  it('lists the Candidats declared in the config', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    expect(await actions.listCandidats()).toEqual([{ id: 'lea', name: 'Léa' }]);
  });

  it('gives each Candidat an empty Profil folder on first launch', async () => {
    const dataDirectory = createDataDirectory();

    await createActions({ dataDirectory });

    expect(listLeaProfilFiles(dataDirectory)).toEqual([]);
  });

  it('keeps the existing Profil and Candidats when launched again', async () => {
    const dataDirectory = createDataDirectory();
    await createActions({ dataDirectory });
    writeFileSync(path.join(dataDirectory, 'candidats', 'lea', 'profil', 'faits.md'), '# Faits\n');

    const actions = await createActions({ dataDirectory });

    expect(listLeaProfilFiles(dataDirectory)).toEqual(['faits.md']);
    expect(await actions.listCandidats()).toEqual([{ id: 'lea', name: 'Léa' }]);
  });

  it('forgets a Candidat removed from the config', async () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, {
      defaultDelayMonths: 6,
      candidatList: [candidatConfig('lea', 'Léa'), candidatConfig('vincent', 'Vincent')],
    });
    await createActions({ dataDirectory });
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidatList: [candidatConfig('lea', 'Léa')] });

    const actions = await createActions({ dataDirectory });

    expect(await actions.listCandidats()).toEqual([{ id: 'lea', name: 'Léa' }]);
  });

  it('brings the database an older jf left up to date', async () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidatList: [candidatConfig('lea', 'Léa')] });
    writeOlderDatabase(dataDirectory);

    const actions = await createActions({ dataDirectory });

    // The Canaux de notification came with a later migration
    expect(await actions.readCanalNotification({ candidatId: 'lea' })).toEqual({
      module: null,
      parametres: {},
      configuredSecretList: [],
    });
  });

  // The main checkout migrates the real data/: Léa keeps her Connexion, nothing to type again
  it('turns the Connexion Home Assistant of each Candidat into their Canal de notification, without loss', async () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidatList: [candidatConfig('lea', 'Léa')] });
    const database = new DatabaseSync(writeOlderDatabase(dataDirectory, CONNEXION_HOME_ASSISTANT_MIGRATION));
    database.exec(`INSERT INTO Candidat (id, name) VALUES ('lea', 'Léa');
      INSERT INTO ConnexionHomeAssistant (candidatId, url, token, service)
      VALUES ('lea', 'https://domotique.example', 'jeton-de-lea', 'notify.mobile_app_iphone_de_lea');`);
    database.close();

    const actions = await createActions({ dataDirectory });

    expect(await actions.readCanalNotification({ candidatId: 'lea' })).toEqual({
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
    expect(migrated.prepare('SELECT id, candidatId, source, parametres, detectedAt FROM Veille').all()).toEqual([
      {
        id: 'attache-de-justice-hauts-de-france',
        candidatId: 'lea',
        source: 'pep',
        parametres: '{"title":"attaché de justice","courtOfAppealList":["Douai","Amiens"]}',
        detectedAt: '2026-10-30T10:44:22.500+00:00',
      },
    ]);
    migrated.close();
  });

  it('refuses to list the Offres of an unknown Candidat', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.listOffres({ candidatId: 'inconnu' })).rejects.toThrow(/Candidat inconnu : inconnu/);
  });

  it('refuses to start without a config, pointing to the example', async () => {
    await expect(createActions({ dataDirectory: createEmptyDataDirectory() })).rejects.toThrow(/config\.example\.json/);
  });

  it('refuses an invalid config, naming the faulty field', async () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidatList: [{ id: 'lea' }] });

    await expect(createActions({ dataDirectory })).rejects.toThrow(/candidatList\[0\]\.name/);
  });
});
