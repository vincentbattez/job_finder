import { cpSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

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
  return { id, name, notification: { channel: 'home-assistant', service: `notify.mobile_app_${id}` }, veilleList: [] };
}

const PRISMA_DIRECTORY = path.join(import.meta.dirname, '..', 'prisma');
const FIRST_MIGRATION = '20261029133617_init';

// The database the first jf left, migrated through a config that only knows the first migration
function writeFirstMigrationDatabase(dataDirectory: string): void {
  const prismaDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-prisma-'));
  for (const fileName of [FIRST_MIGRATION, 'migration_lock.toml']) {
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
    writeFirstMigrationDatabase(dataDirectory);

    const actions = await createActions({ dataDirectory });

    // The Connexion Home Assistant came with a later migration
    expect(await actions.readConnexionHomeAssistant({ candidatId: 'lea' })).toMatchObject({
      service: 'notify.mobile_app_lea',
    });
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
