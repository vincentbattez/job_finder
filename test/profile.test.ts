import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// What jf profile leaves in Léa's Profile, as the Claude session would write it
async function openProfile() {
  const dataDirectory = createDataDirectory();
  const actions = await createActions({ dataDirectory, aiSession: createFakeAiSession() });
  const profileDirectory = path.join(dataDirectory, 'candidates/lea/profile');
  writeFileSync(path.join(profileDirectory, 'facts.md'), '# Faits\n\n## Diplômes\n\n- Master 2 droit privé\n');
  writeFileSync(path.join(profileDirectory, 'cv.md'), '# CV de Léa\n');
  return { actions, dataDirectory, profileDirectory };
}

describe('profile', () => {
  it("opens an interactive session in the chosen Candidate's Profile, naming the Candidate", async () => {
    const dataDirectory = createDataDirectory();
    const aiSession = createFakeAiSession();
    const actions = await createActions({ dataDirectory, aiSession });

    await actions.openProfile({ candidateId: 'lea' });

    expect(aiSession.interactiveSessionList.map(({ directory }) => directory)).toEqual([
      path.join(dataDirectory, 'candidates', 'lea', 'profile'),
    ]);
    expect(aiSession.interactiveSessionList[0]?.prompt).toContain('Léa');
  });

  it('refuses an unknown Candidate without opening a session', async () => {
    const aiSession = createFakeAiSession();
    const actions = await createActions({ dataDirectory: createDataDirectory(), aiSession });

    await expect(actions.openProfile({ candidateId: 'vincent' })).rejects.toThrow(/Candidat inconnu : vincent/);
    expect(aiSession.interactiveSessionList).toEqual([]);
  });

  it('shows the Markdown files of the Profile of a Candidate', async () => {
    const { actions } = await openProfile();

    const profileFileList = await actions.listProfileFiles({ candidateId: 'lea' });

    expect(profileFileList).toEqual([
      { fileName: 'cv.md', markdown: '# CV de Léa\n' },
      { fileName: 'facts.md', markdown: '# Faits\n\n## Diplômes\n\n- Master 2 droit privé\n' },
    ]);
  });

  it('modifies a file of the Profile', async () => {
    const { actions } = await openProfile();

    await actions.saveProfileFile({ candidateId: 'lea', fileName: 'facts.md', markdown: '# Faits\n\n- Master 2\n' });

    expect(await actions.listProfileFiles({ candidateId: 'lea' })).toEqual([
      { fileName: 'cv.md', markdown: '# CV de Léa\n' },
      { fileName: 'facts.md', markdown: '# Faits\n\n- Master 2\n' },
    ]);
  });

  it('creates a file in the Profile, then lists it', async () => {
    const { actions } = await openProfile();

    await actions.createProfileFile({
      candidateId: 'lea',
      fileName: 'lettre-tj-lille-2025.md',
      markdown: '# Lettre\n',
    });
    await actions.createProfileFile({ candidateId: 'lea', fileName: 'vide.md' });

    expect(await actions.listProfileFiles({ candidateId: 'lea' })).toEqual([
      { fileName: 'cv.md', markdown: '# CV de Léa\n' },
      { fileName: 'facts.md', markdown: '# Faits\n\n## Diplômes\n\n- Master 2 droit privé\n' },
      { fileName: 'lettre-tj-lille-2025.md', markdown: '# Lettre\n' },
      { fileName: 'vide.md', markdown: '' },
    ]);
  });

  it('opens jf profile on the files created from the front', async () => {
    const aiSession = createFakeAiSession();
    const dataDirectory = createDataDirectory();
    const actions = await createActions({ dataDirectory, aiSession });

    await actions.createProfileFile({ candidateId: 'lea', fileName: 'lettre-présidente.md', markdown: '# Lettre\n' });
    await actions.openProfile({ candidateId: 'lea' });

    const directory = aiSession.interactiveSessionList[0]?.directory ?? '';
    expect(readdirSync(directory)).toEqual(['lettre-présidente.md']);
  });

  it('refuses to create a file the Profile already has, and keeps it', async () => {
    const { actions } = await openProfile();

    await expect(
      actions.createProfileFile({ candidateId: 'lea', fileName: 'cv.md', markdown: 'Remplacé\n' }),
    ).rejects.toThrow('Le Profil de Léa a déjà un fichier « cv.md »');
    expect(await actions.listProfileFiles({ candidateId: 'lea' })).toContainEqual({
      fileName: 'cv.md',
      markdown: '# CV de Léa\n',
    });
  });

  it('deletes a file of the Profile', async () => {
    const { actions } = await openProfile();

    await actions.deleteProfileFile({ candidateId: 'lea', fileName: 'cv.md' });

    expect(await actions.listProfileFiles({ candidateId: 'lea' })).toEqual([
      { fileName: 'facts.md', markdown: '# Faits\n\n## Diplômes\n\n- Master 2 droit privé\n' },
    ]);
  });

  it('refuses to delete a file the Profile does not have', async () => {
    const { actions } = await openProfile();

    await expect(actions.deleteProfileFile({ candidateId: 'lea', fileName: 'lettre.md' })).rejects.toThrow(
      "Le Profil de Léa n'a pas de fichier « lettre.md »",
    );
  });

  it('refuses to write « nouveau.md » until it is created', async () => {
    const { actions } = await openProfile();

    await expect(
      actions.saveProfileFile({ candidateId: 'lea', fileName: 'nouveau.md', markdown: 'Texte\n' }),
    ).rejects.toThrow("Le Profil de Léa n'a pas de fichier « nouveau.md »");
    await actions.createProfileFile({ candidateId: 'lea', fileName: 'nouveau.md' });
    await actions.saveProfileFile({ candidateId: 'lea', fileName: 'nouveau.md', markdown: 'Texte\n' });

    expect(await actions.listProfileFiles({ candidateId: 'lea' })).toContainEqual({
      fileName: 'nouveau.md',
      markdown: 'Texte\n',
    });
  });

  // The file name comes from the front: nothing outside the files of the Profile may be touched
  describe.each(['createProfileFile', 'saveProfileFile', 'deleteProfileFile'] as const)('%s', (actionName) => {
    it.each(['../../notes.md', '../facts.md', 'sous-dossier/facts.md', 'facts', '.md', 'facts.md/'])(
      'refuses « %s », not a name of a Profile file, and touches nothing',
      async (fileName) => {
        const { actions, dataDirectory } = await openProfile();
        // A file of the data folder, out of the Profile
        writeFileSync(path.join(dataDirectory, 'notes.md'), '# Notes\n');

        await expect(actions[actionName]({ candidateId: 'lea', fileName, markdown: 'Remplacé\n' })).rejects.toThrow(
          `« ${fileName} » n'est pas un nom de fichier du Profil`,
        );
        expect(readFileSync(path.join(dataDirectory, 'notes.md'), 'utf8')).toBe('# Notes\n');
        expect(
          readdirSync(path.join(dataDirectory, 'candidates/lea'), { recursive: true, encoding: 'utf8' }).toSorted(
            (first, second) => first.localeCompare(second),
          ),
        ).toEqual(['profile', 'profile/cv.md', 'profile/facts.md']);
        expect(readFileSync(path.join(dataDirectory, 'candidates/lea/profile/facts.md'), 'utf8')).toBe(
          '# Faits\n\n## Diplômes\n\n- Master 2 droit privé\n',
        );
      },
    );
  });

  it('reads the Facts by section, in the order of the form', async () => {
    const { actions } = await openProfile();

    const sectionList = await actions.readFacts({ candidateId: 'lea' });

    expect(sectionList.map(({ title, entryList }) => [title, entryList])).toEqual([
      ['Identité', ['']],
      ['Coordonnées', ['']],
      ['Diplômes', ['Master 2 droit privé']],
      ['Expériences', []],
      ['Compétences', ['']],
      ['Motivations', ['']],
      ['Mobilité', ['']],
    ]);
  });

  it('saves the Facts into facts.md, keeping what the form does not show', async () => {
    const { actions, profileDirectory } = await openProfile();
    writeFileSync(
      path.join(profileDirectory, 'facts.md'),
      '# Faits\n\nValidés par Léa.\n\n## Diplômes\n\n- Master 2 droit privé\n\n## Stages\n\n- Cabinet Dupont, 2024\n',
    );

    await actions.saveFacts({
      candidateId: 'lea',
      entryListByTitle: {
        Identité: ['Léa Martin'],
        Diplômes: ['Master 2 droit privé', 'Licence de droit'],
        Expériences: ['Assistante juridique, Cabinet Martin, 2025'],
      },
    });

    expect(readFileSync(path.join(profileDirectory, 'facts.md'), 'utf8')).toBe(
      '# Faits\n\nValidés par Léa.\n\n## Identité\n\nLéa Martin\n\n## Diplômes\n\n- Master 2 droit privé\n- Licence de droit\n\n## Stages\n\n- Cabinet Dupont, 2024\n\n## Expériences\n\n- Assistante juridique, Cabinet Martin, 2025\n',
    );
    expect(readFileSync(path.join(profileDirectory, 'cv.md'), 'utf8')).toBe('# CV de Léa\n');
  });

  it('creates facts.md when the Profile has none', async () => {
    const dataDirectory = createDataDirectory();
    const actions = await createActions({ dataDirectory, aiSession: createFakeAiSession() });

    await actions.saveFacts({ candidateId: 'lea', entryListByTitle: { Mobilité: ['Lille'] } });

    expect(await actions.listProfileFiles({ candidateId: 'lea' })).toEqual([
      { fileName: 'facts.md', markdown: '# Faits\n\n## Mobilité\n\nLille\n' },
    ]);
  });

  // One list for both, so that the form reads what Claude writes
  it('asks jf profile to write facts.md by the sections of the form', async () => {
    const dataDirectory = createDataDirectory();
    const aiSession = createFakeAiSession();
    const actions = await createActions({ dataDirectory, aiSession });

    await actions.openProfile({ candidateId: 'lea' });

    expect(aiSession.interactiveSessionList[0]?.prompt).toContain(
      'rangés par rubrique : Identité, Coordonnées, Diplômes, Expériences, Compétences, Motivations, Mobilité.',
    );
  });
});
