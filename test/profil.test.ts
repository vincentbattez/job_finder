import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

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

  it('creates a file in the Profil, then lists it', async () => {
    const { actions } = await openProfil();

    await actions.createProfilFile({ candidatId: 'lea', fileName: 'lettre-tj-lille-2025.md', markdown: '# Lettre\n' });
    await actions.createProfilFile({ candidatId: 'lea', fileName: 'vide.md' });

    expect(await actions.listProfilFiles({ candidatId: 'lea' })).toEqual([
      { fileName: 'cv.md', markdown: '# CV de Léa\n' },
      { fileName: 'faits.md', markdown: '# Faits\n\n## Diplômes\n\n- Master 2 droit privé\n' },
      { fileName: 'lettre-tj-lille-2025.md', markdown: '# Lettre\n' },
      { fileName: 'vide.md', markdown: '' },
    ]);
  });

  it('opens jf profil on the files created from the front', async () => {
    const aiSession = createFakeAiSession();
    const dataDirectory = createDataDirectory();
    const actions = await createActions({ dataDirectory, aiSession });

    await actions.createProfilFile({ candidatId: 'lea', fileName: 'lettre-présidente.md', markdown: '# Lettre\n' });
    await actions.openProfil({ candidatId: 'lea' });

    const directory = aiSession.interactiveSessionList[0]?.directory ?? '';
    expect(readdirSync(directory)).toEqual(['lettre-présidente.md']);
  });

  it('refuses to create a file the Profil already has, and keeps it', async () => {
    const { actions } = await openProfil();

    await expect(
      actions.createProfilFile({ candidatId: 'lea', fileName: 'cv.md', markdown: 'Remplacé\n' }),
    ).rejects.toThrow('Le Profil de Léa a déjà un fichier « cv.md »');
    expect(await actions.listProfilFiles({ candidatId: 'lea' })).toContainEqual({
      fileName: 'cv.md',
      markdown: '# CV de Léa\n',
    });
  });

  it('deletes a file of the Profil', async () => {
    const { actions } = await openProfil();

    await actions.deleteProfilFile({ candidatId: 'lea', fileName: 'cv.md' });

    expect(await actions.listProfilFiles({ candidatId: 'lea' })).toEqual([
      { fileName: 'faits.md', markdown: '# Faits\n\n## Diplômes\n\n- Master 2 droit privé\n' },
    ]);
  });

  it('refuses to delete a file the Profil does not have', async () => {
    const { actions } = await openProfil();

    await expect(actions.deleteProfilFile({ candidatId: 'lea', fileName: 'lettre.md' })).rejects.toThrow(
      "Le Profil de Léa n'a pas de fichier « lettre.md »",
    );
  });

  it('refuses to write « nouveau.md » until it is created', async () => {
    const { actions } = await openProfil();

    await expect(
      actions.saveProfilFile({ candidatId: 'lea', fileName: 'nouveau.md', markdown: 'Texte\n' }),
    ).rejects.toThrow("Le Profil de Léa n'a pas de fichier « nouveau.md »");
    await actions.createProfilFile({ candidatId: 'lea', fileName: 'nouveau.md' });
    await actions.saveProfilFile({ candidatId: 'lea', fileName: 'nouveau.md', markdown: 'Texte\n' });

    expect(await actions.listProfilFiles({ candidatId: 'lea' })).toContainEqual({
      fileName: 'nouveau.md',
      markdown: 'Texte\n',
    });
  });

  // The file name comes from the front: nothing outside the files of the Profil may be touched
  describe.each(['createProfilFile', 'saveProfilFile', 'deleteProfilFile'] as const)('%s', (actionName) => {
    it.each(['../../config.json', '../faits.md', 'sous-dossier/faits.md', 'faits', '.md', 'faits.md/'])(
      'refuses « %s », not a name of a Profil file, and touches nothing',
      async (fileName) => {
        const { actions, dataDirectory } = await openProfil();
        const config = readFileSync(path.join(dataDirectory, 'config.json'), 'utf8');

        await expect(actions[actionName]({ candidatId: 'lea', fileName, markdown: 'Remplacé\n' })).rejects.toThrow(
          `« ${fileName} » n'est pas un nom de fichier du Profil`,
        );
        expect(readFileSync(path.join(dataDirectory, 'config.json'), 'utf8')).toBe(config);
        expect(
          readdirSync(path.join(dataDirectory, 'candidats/lea'), { recursive: true, encoding: 'utf8' }).toSorted(
            (first, second) => first.localeCompare(second),
          ),
        ).toEqual(['profil', 'profil/cv.md', 'profil/faits.md']);
        expect(readFileSync(path.join(dataDirectory, 'candidats/lea/profil/faits.md'), 'utf8')).toBe(
          '# Faits\n\n## Diplômes\n\n- Master 2 droit privé\n',
        );
      },
    );
  });
});
