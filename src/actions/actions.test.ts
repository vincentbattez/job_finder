import { copyFileSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', '..', 'config.example.json');

function createEmptyDataDirectory(): string {
  return mkdtempSync(path.join(tmpdir(), 'job-finder-'));
}

function createDataDirectoryFromExample(): string {
  const dataDirectory = createEmptyDataDirectory();
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  return dataDirectory;
}

function writeConfig(dataDirectory: string, config: object): void {
  writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify(config));
}

function candidatConfig(id: string, name: string): object {
  return { id, name, notification: { channel: 'home-assistant', service: `notify.mobile_app_${id}` }, veilleList: [] };
}

function listLeaProfilFiles(dataDirectory: string): string[] {
  return readdirSync(path.join(dataDirectory, 'candidats', 'lea', 'profil'));
}

describe('actions', () => {
  it('lists the Candidats declared in the config', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectoryFromExample() });

    expect(await actions.listCandidats()).toEqual([{ id: 'lea', name: 'Léa' }]);
  });

  it('gives each Candidat an empty Profil folder on first launch', async () => {
    const dataDirectory = createDataDirectoryFromExample();

    await createActions({ dataDirectory });

    expect(listLeaProfilFiles(dataDirectory)).toEqual([]);
  });

  it('keeps the existing Profil and Candidats when launched again', async () => {
    const dataDirectory = createDataDirectoryFromExample();
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

  it('refuses to list the Offres of an unknown Candidat', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectoryFromExample() });

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
