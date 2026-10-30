import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

const CV_PDF = new Uint8Array(readFileSync(path.join(import.meta.dirname, 'fixtures/profil/cv.pdf')));

const CV_MARKDOWN = '# CV de Léa\n\n## Formation\n\n- Master 2 droit public, Université de Lille, 2024\n';

// What the session writes when it converts the CV
const CV_RUN = { fileByName: { 'cv.md': CV_MARKDOWN } };

// Léa's Profil, with the faits.md that jf profil wrote
async function openProfil(aiSession: ReturnType<typeof createFakeAiSession>) {
  const dataDirectory = createDataDirectory();
  const actions = await createActions({ dataDirectory, aiSession });
  const profilDirectory = path.join(dataDirectory, 'candidats/lea/profil');
  writeFileSync(path.join(profilDirectory, 'faits.md'), '# Faits\n');
  return { actions, profilDirectory };
}

// That of Léa's CV, her only Pièce
async function conversionOf(actions: Actions) {
  const [piece] = await actions.listPieces({ candidatId: 'lea' });
  return piece?.conversion;
}

async function profilFileNameListOf(actions: Actions) {
  const profilFileList = await actions.listProfilFiles({ candidatId: 'lea' });
  return profilFileList.map(({ fileName }) => fileName);
}

describe('conversion of a Pièce', () => {
  it('queues the conversion of a dropped Pièce, which the worker writes into the Profil', async () => {
    const aiSession = createFakeAiSession(CV_RUN);
    const { actions, profilDirectory } = await openProfil(aiSession);

    await actions.savePiece({ candidatId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    expect(await conversionOf(actions)).toEqual({ etat: 'en_cours', log: '' });
    await actions.runQueuedJobs();
    const [session] = aiSession.headlessSessionList;
    expect(session?.directory).toBe(profilDirectory);
    expect(session?.fixedPrompt).toContain('pieces/cv.pdf');
    expect(session?.fixedPrompt).toContain('convertis-le fidèlement en Markdown, sans le réécrire');
    expect(session?.fixedPrompt).toContain('lettre-<employeur>-<année>.md');
    expect(await actions.listProfilFiles({ candidatId: 'lea' })).toEqual([
      { fileName: 'cv.md', markdown: CV_MARKDOWN },
      { fileName: 'faits.md', markdown: '# Faits\n' },
    ]);
    expect(await conversionOf(actions)).toMatchObject({ etat: 'pret' });
  });

  it('shares its conversion rules with jf profil', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await openProfil(aiSession);

    await actions.openProfil({ candidatId: 'lea' });

    expect(aiSession.interactiveSessionList[0]?.prompt).toContain(
      'convertis-le fidèlement en Markdown, sans le réécrire',
    );
  });

  it('queues a single conversion of a Pièce however often it is relaunched', async () => {
    const aiSession = createFakeAiSession(CV_RUN, CV_RUN);
    const { actions } = await openProfil(aiSession);
    await actions.savePiece({ candidatId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    await actions.convertPiece({ candidatId: 'lea', fileName: 'cv.pdf' });
    await actions.runQueuedJobs();
    await actions.convertPiece({ candidatId: 'lea', fileName: 'cv.pdf' });
    await actions.runQueuedJobs();

    expect(aiSession.headlessSessionList).toHaveLength(2);
    expect(await conversionOf(actions)).toMatchObject({ etat: 'pret' });
    expect(await profilFileNameListOf(actions)).toEqual(['cv.md', 'faits.md']);
  });

  it('never overwrites a file of the Profil, and says so', async () => {
    const aiSession = createFakeAiSession(CV_RUN, CV_RUN);
    const { actions, profilDirectory } = await openProfil(aiSession);
    writeFileSync(path.join(profilDirectory, 'cv.md'), '# Mon CV corrigé à la main\n');
    await actions.savePiece({ candidatId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    await actions.runQueuedJobs();

    expect(readFileSync(path.join(profilDirectory, 'cv.md'), 'utf8')).toBe('# Mon CV corrigé à la main\n');
    const failure = await conversionOf(actions);
    expect(failure?.etat).toBe('en_echec');
    expect(failure?.log).toContain(
      "« cv.pdf » se convertit en « cv.md », que le Profil a déjà : il n'est pas écrasé. Supprimer ou renommer « cv.md », puis relancer la conversion.",
    );

    await actions.deleteProfilFile({ candidatId: 'lea', fileName: 'cv.md' });
    await actions.convertPiece({ candidatId: 'lea', fileName: 'cv.pdf' });
    await actions.runQueuedJobs();

    expect(readFileSync(path.join(profilDirectory, 'cv.md'), 'utf8')).toBe(CV_MARKDOWN);
    expect(await conversionOf(actions)).toMatchObject({ etat: 'pret' });
  });

  it('shows why a conversion failed, and runs it again when relaunched', async () => {
    const aiSession = createFakeAiSession({ isSuccess: false }, { fileByName: { 'notes.md': '# Notes\n' } }, CV_RUN);
    const { actions } = await openProfil(aiSession);
    await actions.savePiece({ candidatId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    await actions.runQueuedJobs();
    const sessionFailure = await conversionOf(actions);
    expect(sessionFailure?.etat).toBe('en_echec');
    expect(sessionFailure?.log).toContain('Claude Code a rencontré une erreur.');
    await actions.convertPiece({ candidatId: 'lea', fileName: 'cv.pdf' });
    await actions.runQueuedJobs();
    const nameFailure = await conversionOf(actions);
    expect(nameFailure?.etat).toBe('en_echec');
    expect(nameFailure?.log).toContain(
      "« notes.md » n'est ni « cv.md » ni une lettre « lettre-<employeur>-<année>.md »",
    );
    await actions.convertPiece({ candidatId: 'lea', fileName: 'cv.pdf' });
    await actions.runQueuedJobs();

    expect(await conversionOf(actions)).toMatchObject({ etat: 'pret' });
    expect(await profilFileNameListOf(actions)).toEqual(['cv.md', 'faits.md']);
  });

  it('refuses to convert a Pièce the Profil does not have', async () => {
    const { actions } = await openProfil(createFakeAiSession());

    await expect(actions.convertPiece({ candidatId: 'lea', fileName: 'cv.pdf' })).rejects.toThrow(
      "Le Profil de Léa n'a pas de Pièce « cv.pdf »",
    );
  });

  it('fails the conversion of a Pièce deleted while it waited', async () => {
    const aiSession = createFakeAiSession(CV_RUN);
    const { actions } = await openProfil(aiSession);
    await actions.savePiece({ candidatId: 'lea', fileName: 'cv.pdf', content: CV_PDF });
    await actions.deletePiece({ candidatId: 'lea', fileName: 'cv.pdf' });

    const [job] = await actions.runQueuedJobs();

    expect(job?.state).toBe('failed');
    expect(job?.log).toContain("« cv.pdf » n'est plus dans le Profil");
    expect(aiSession.headlessSessionList).toEqual([]);
  });
});
