import { copyFileSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

// What jf profil leaves in Léa's Profil, as the Claude session would write it
async function openProfil() {
  const dataDirectory = createDataDirectory();
  const actions = await createActions({ dataDirectory, aiSession: createFakeAiSession() });
  const profilDirectory = path.join(dataDirectory, 'candidats/lea/profil');
  writeFileSync(path.join(profilDirectory, 'faits.md'), '# Faits\n\n## Diplômes\n\n- Master 2 droit privé\n');
  writeFileSync(path.join(profilDirectory, 'cv.md'), '# CV de Léa\n');
  return { actions, dataDirectory, profilDirectory };
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

  it('shows the Markdown files of the Profil of a Candidat', async () => {
    const { actions } = await openProfil();

    const profilFileList = await actions.listProfilFiles({ candidatId: 'lea' });

    expect(profilFileList).toEqual([
      { fileName: 'cv.md', markdown: '# CV de Léa\n' },
      { fileName: 'faits.md', markdown: '# Faits\n\n## Diplômes\n\n- Master 2 droit privé\n' },
    ]);
  });

  it('modifies a file of the Profil', async () => {
    const { actions } = await openProfil();

    await actions.saveProfilFile({ candidatId: 'lea', fileName: 'faits.md', markdown: '# Faits\n\n- Master 2\n' });

    expect(await actions.listProfilFiles({ candidatId: 'lea' })).toEqual([
      { fileName: 'cv.md', markdown: '# CV de Léa\n' },
      { fileName: 'faits.md', markdown: '# Faits\n\n- Master 2\n' },
    ]);
  });

  // The file name comes from the front: nothing outside the files of the Profil may be written
  it.each(['../../config.json', '../faits.md', 'sous-dossier/faits.md', 'nouveau.md'])(
    'refuses to write « %s », not a file of the Profil, and writes nothing',
    async (fileName) => {
      const { actions, dataDirectory } = await openProfil();
      const config = readFileSync(path.join(dataDirectory, 'config.json'), 'utf8');

      await expect(actions.saveProfilFile({ candidatId: 'lea', fileName, markdown: 'Remplacé\n' })).rejects.toThrow(
        `Le Profil de Léa n'a pas de fichier « ${fileName} »`,
      );
      expect(readFileSync(path.join(dataDirectory, 'config.json'), 'utf8')).toBe(config);
      expect(
        readdirSync(path.join(dataDirectory, 'candidats/lea'), { recursive: true, encoding: 'utf8' }).toSorted(
          (first, second) => first.localeCompare(second),
        ),
      ).toEqual(['profil', 'profil/cv.md', 'profil/faits.md']);
    },
  );
});
