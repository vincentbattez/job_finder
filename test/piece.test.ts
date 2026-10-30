import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

const CV_PDF = new Uint8Array(readFileSync(path.join(import.meta.dirname, 'fixtures/profil/cv.pdf')));

// Léa's Profil, with a faits.md that jf profil wrote
async function openProfil() {
  const dataDirectory = createDataDirectory();
  const actions = await createActions({ dataDirectory, aiSession: createFakeAiSession() });
  const profilDirectory = path.join(dataDirectory, 'candidats/lea/profil');
  writeFileSync(path.join(profilDirectory, 'faits.md'), '# Faits\n');
  return { actions, profilDirectory };
}

describe('pièce', () => {
  it('keeps a PDF Pièce as dropped, then lists it with its date', async () => {
    const { actions, profilDirectory } = await openProfil();
    const before = Date.now();

    await actions.savePiece({ candidatId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    expect(readFileSync(path.join(profilDirectory, 'pieces/cv.pdf'))).toEqual(Buffer.from(CV_PDF));
    const pieceList = await actions.listPieces({ candidatId: 'lea' });
    expect(pieceList.map(({ fileName }) => fileName)).toEqual(['cv.pdf']);
    expect(pieceList[0]?.savedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('replaces a Pièce of the same name, keeping a single one', async () => {
    const { actions, profilDirectory } = await openProfil();
    const newCv = new TextEncoder().encode('%PDF-1.4\nCV mis à jour\n');

    await actions.savePiece({ candidatId: 'lea', fileName: 'cv.pdf', content: CV_PDF });
    await actions.savePiece({ candidatId: 'lea', fileName: 'cv.pdf', content: newCv });

    expect(readFileSync(path.join(profilDirectory, 'pieces/cv.pdf'))).toEqual(Buffer.from(newCv));
    const pieceList = await actions.listPieces({ candidatId: 'lea' });
    expect(pieceList.map(({ fileName }) => fileName)).toEqual(['cv.pdf']);
  });

  it.each([
    ['../cv.pdf', CV_PDF, "« ../cv.pdf » n'est pas un nom de Pièce"],
    ['pieces/../../faits.md', CV_PDF, "n'est pas un nom de Pièce"],
    ['cv.md', CV_PDF, "« cv.md » n'est pas un nom de Pièce"],
    ['cv.pdf', new TextEncoder().encode('# CV de Léa\n'), "« cv.pdf » n'est pas un PDF"],
  ])('refuses « %s » without writing anything', async (fileName, content, message) => {
    const { actions, profilDirectory } = await openProfil();

    await expect(actions.savePiece({ candidatId: 'lea', fileName, content })).rejects.toThrow(message);
    expect(readdirSync(profilDirectory, { recursive: true })).toEqual(['faits.md']);
  });

  it('refuses a PDF of more than 10 Mo without writing it', async () => {
    const { actions, profilDirectory } = await openProfil();
    const content = new Uint8Array(10 * 1024 * 1024 + 1);
    content.set(CV_PDF);

    await expect(actions.savePiece({ candidatId: 'lea', fileName: 'gros.pdf', content })).rejects.toThrow(
      '« gros.pdf » dépasse 10 Mo',
    );
    expect(readdirSync(profilDirectory, { recursive: true })).toEqual(['faits.md']);
  });

  it('deletes a Pièce, and refuses one the Profil does not have', async () => {
    const { actions } = await openProfil();
    await actions.savePiece({ candidatId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    await actions.deletePiece({ candidatId: 'lea', fileName: 'cv.pdf' });

    expect(await actions.listPieces({ candidatId: 'lea' })).toEqual([]);
    await expect(actions.deletePiece({ candidatId: 'lea', fileName: 'cv.pdf' })).rejects.toThrow(
      "Le Profil de Léa n'a pas de Pièce « cv.pdf »",
    );
  });

  // The Markdown editor shows the files of the Profil: a Pièce is not one of them
  it('leaves the Pièces out of the files of the Profil', async () => {
    const { actions } = await openProfil();

    await actions.savePiece({ candidatId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    expect(await actions.listProfilFiles({ candidatId: 'lea' })).toEqual([
      { fileName: 'faits.md', markdown: '# Faits\n' },
    ]);
  });
});
