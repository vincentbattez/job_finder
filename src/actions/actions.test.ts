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
  it('lists the Candidats declared in the config', () => {
    const actions = createActions({ dataDirectory: createDataDirectoryFromExample() });

    expect(actions.listCandidats()).toEqual([{ id: 'lea', name: 'Léa' }]);
  });

  it('gives each Candidat an empty Profil folder on first launch', () => {
    const dataDirectory = createDataDirectoryFromExample();

    createActions({ dataDirectory });

    expect(listLeaProfilFiles(dataDirectory)).toEqual([]);
  });

  it('keeps the existing Profil and Candidats when launched again', () => {
    const dataDirectory = createDataDirectoryFromExample();
    createActions({ dataDirectory });
    writeFileSync(path.join(dataDirectory, 'candidats', 'lea', 'profil', 'faits.md'), '# Faits\n');

    const actions = createActions({ dataDirectory });

    expect(listLeaProfilFiles(dataDirectory)).toEqual(['faits.md']);
    expect(actions.listCandidats()).toEqual([{ id: 'lea', name: 'Léa' }]);
  });

  it('forgets a Candidat removed from the config', () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, {
      defaultDelayMonths: 6,
      candidatList: [candidatConfig('lea', 'Léa'), candidatConfig('vincent', 'Vincent')],
    });
    createActions({ dataDirectory });
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidatList: [candidatConfig('lea', 'Léa')] });

    expect(createActions({ dataDirectory }).listCandidats()).toEqual([{ id: 'lea', name: 'Léa' }]);
  });

  it('refuses to start without a config, pointing to the example', () => {
    expect(() => createActions({ dataDirectory: createEmptyDataDirectory() })).toThrow(/config\.example\.json/);
  });

  it('refuses an invalid config, naming the faulty field', () => {
    const dataDirectory = createEmptyDataDirectory();
    writeConfig(dataDirectory, { defaultDelayMonths: 6, candidatList: [{ id: 'lea' }] });

    expect(() => createActions({ dataDirectory })).toThrow(/candidatList\[0\]\.name/);
  });
});
