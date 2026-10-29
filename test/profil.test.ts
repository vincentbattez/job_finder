import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';

const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', 'config.example.json');

function createDataDirectory(): string {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  return dataDirectory;
}

describe('profil', () => {
  it("opens an interactive session in the chosen Candidat's Profil, naming the Candidat", async () => {
    const dataDirectory = createDataDirectory();
    const aiSession = createFakeAiSession();
    const actions = await createActions({ dataDirectory, aiSession });

    await actions.openProfil({ candidatId: 'lea' });

    expect(aiSession.interactiveSessionList.map(({ directory }) => directory)).toEqual([
      path.join(dataDirectory, 'candidats', 'lea', 'profil'),
    ]);
    expect(aiSession.interactiveSessionList[0]?.prompt).toContain('Léa');
  });

  it('refuses an unknown Candidat without opening a session', async () => {
    const aiSession = createFakeAiSession();
    const actions = await createActions({ dataDirectory: createDataDirectory(), aiSession });

    await expect(actions.openProfil({ candidatId: 'vincent' })).rejects.toThrow(/Candidat inconnu : vincent/);
    expect(aiSession.interactiveSessionList).toEqual([]);
  });
});
