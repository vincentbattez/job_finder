import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

const CV_PDF = new Uint8Array(readFileSync(path.join(import.meta.dirname, 'fixtures/profile/cv.pdf')));

// Léa's Profile, with a facts.md that jf profile wrote
async function openProfile() {
  const dataDirectory = createDataDirectory();
  const actions = await createActions({ dataDirectory, aiSession: createFakeAiSession() });
  const profileDirectory = path.join(dataDirectory, 'candidates/lea/profile');
  writeFileSync(path.join(profileDirectory, 'facts.md'), '# Faits\n');
  return { actions, profileDirectory };
}

describe('upload', () => {
  it('keeps a PDF Upload as dropped, then lists it with its date', async () => {
    const { actions, profileDirectory } = await openProfile();
    const before = Date.now();

    await actions.saveUpload({ candidateId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    expect(readFileSync(path.join(profileDirectory, 'uploads/cv.pdf'))).toEqual(Buffer.from(CV_PDF));
    const uploadList = await actions.listUploads({ candidateId: 'lea' });
    expect(uploadList.map(({ fileName }) => fileName)).toEqual(['cv.pdf']);
    expect(uploadList[0]?.savedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('replaces an Upload of the same name, keeping a single one', async () => {
    const { actions, profileDirectory } = await openProfile();
    const newCv = new TextEncoder().encode('%PDF-1.4\nCV mis à jour\n');

    await actions.saveUpload({ candidateId: 'lea', fileName: 'cv.pdf', content: CV_PDF });
    await actions.saveUpload({ candidateId: 'lea', fileName: 'cv.pdf', content: newCv });

    expect(readFileSync(path.join(profileDirectory, 'uploads/cv.pdf'))).toEqual(Buffer.from(newCv));
    const uploadList = await actions.listUploads({ candidateId: 'lea' });
    expect(uploadList.map(({ fileName }) => fileName)).toEqual(['cv.pdf']);
  });

  it.each([
    ['../cv.pdf', CV_PDF, "« ../cv.pdf » n'est pas un nom de Pièce"],
    ['uploads/../../facts.md', CV_PDF, "n'est pas un nom de Pièce"],
    ['cv.md', CV_PDF, "« cv.md » n'est pas un nom de Pièce"],
    ['cv.pdf', new TextEncoder().encode('# CV de Léa\n'), "« cv.pdf » n'est pas un PDF"],
    ['', new Uint8Array(), 'Aucun fichier reçu'],
  ])('refuses « %s » without writing anything', async (fileName, content, message) => {
    const { actions, profileDirectory } = await openProfile();

    await expect(actions.saveUpload({ candidateId: 'lea', fileName, content })).rejects.toThrow(message);
    expect(readdirSync(profileDirectory, { recursive: true })).toEqual(['facts.md']);
  });

  it('refuses a PDF of more than 10 Mo without writing it', async () => {
    const { actions, profileDirectory } = await openProfile();
    const content = new Uint8Array(10 * 1024 * 1024 + 1);
    content.set(CV_PDF);

    await expect(actions.saveUpload({ candidateId: 'lea', fileName: 'gros.pdf', content })).rejects.toThrow(
      '« gros.pdf » dépasse 10 Mo',
    );
    expect(readdirSync(profileDirectory, { recursive: true })).toEqual(['facts.md']);
  });

  it('deletes an Upload, and refuses one the Profile does not have', async () => {
    const { actions } = await openProfile();
    await actions.saveUpload({ candidateId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    await actions.deleteUpload({ candidateId: 'lea', fileName: 'cv.pdf' });

    expect(await actions.listUploads({ candidateId: 'lea' })).toEqual([]);
    await expect(actions.deleteUpload({ candidateId: 'lea', fileName: 'cv.pdf' })).rejects.toThrow(
      "Le Profil de Léa n'a pas de Pièce « cv.pdf »",
    );
  });

  // The Markdown editor shows the files of the Profile: an Upload is not one of them
  it('leaves the Uploads out of the files of the Profile', async () => {
    const { actions } = await openProfile();

    await actions.saveUpload({ candidateId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    expect(await actions.listProfileFiles({ candidateId: 'lea' })).toEqual([
      { fileName: 'facts.md', markdown: '# Faits\n' },
    ]);
  });
});
