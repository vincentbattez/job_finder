import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

const CV_PDF = new Uint8Array(readFileSync(path.join(import.meta.dirname, 'fixtures/profile/cv.pdf')));

const CV_MARKDOWN = '# CV de Léa\n\n## Formation\n\n- Master 2 droit public, Université de Lille, 2024\n';

// What the session writes when it converts the CV
const CV_RUN = { fileByName: { 'cv.md': CV_MARKDOWN } };

// Léa's Profile, with the facts.md that jf profile wrote
async function openProfile(aiSession: ReturnType<typeof createFakeAiSession>) {
  const dataDirectory = createDataDirectory();
  const actions = await createActions({ dataDirectory, aiSession });
  const profileDirectory = path.join(dataDirectory, 'candidates/lea/profile');
  writeFileSync(path.join(profileDirectory, 'facts.md'), '# Faits\n');
  return { actions, profileDirectory };
}

// That of Léa's CV, her only Upload
async function conversionOf(actions: Actions) {
  const [upload] = await actions.listUploads({ candidateId: 'lea' });
  return upload?.conversion;
}

async function profileFileNameListOf(actions: Actions) {
  const profileFileList = await actions.listProfileFiles({ candidateId: 'lea' });
  return profileFileList.map(({ fileName }) => fileName);
}

describe('conversion of an Upload', () => {
  it('queues the conversion of a dropped Upload, which the worker writes into the Profile', async () => {
    const aiSession = createFakeAiSession(CV_RUN);
    const { actions, profileDirectory } = await openProfile(aiSession);

    await actions.saveUpload({ candidateId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    expect(await conversionOf(actions)).toEqual({ state: 'in_progress', log: '' });
    await actions.runQueuedJobs();
    const [session] = aiSession.headlessSessionList;
    expect(session?.directory).toBe(profileDirectory);
    expect(session?.fixedPrompt).toContain('uploads/cv.pdf');
    expect(session?.fixedPrompt).toContain('convertis-le fidèlement en Markdown, sans le réécrire');
    expect(session?.fixedPrompt).toContain('lettre-<employeur>-<année>.md');
    expect(await actions.listProfileFiles({ candidateId: 'lea' })).toEqual([
      { fileName: 'cv.md', markdown: CV_MARKDOWN },
      { fileName: 'facts.md', markdown: '# Faits\n' },
    ]);
    expect(await conversionOf(actions)).toMatchObject({ state: 'ready' });
  });

  it('shares its conversion rules with jf profile', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await openProfile(aiSession);

    await actions.openProfile({ candidateId: 'lea' });

    expect(aiSession.interactiveSessionList[0]?.prompt).toContain(
      'convertis-le fidèlement en Markdown, sans le réécrire',
    );
  });

  it('queues a single conversion of an Upload however often it is relaunched', async () => {
    const aiSession = createFakeAiSession(CV_RUN, CV_RUN);
    const { actions } = await openProfile(aiSession);
    await actions.saveUpload({ candidateId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    await actions.convertUpload({ candidateId: 'lea', fileName: 'cv.pdf' });
    await actions.runQueuedJobs();
    await actions.convertUpload({ candidateId: 'lea', fileName: 'cv.pdf' });
    await actions.runQueuedJobs();

    expect(aiSession.headlessSessionList).toHaveLength(2);
    expect(await conversionOf(actions)).toMatchObject({ state: 'ready' });
    expect(await profileFileNameListOf(actions)).toEqual(['cv.md', 'facts.md']);
  });

  it('never overwrites a file of the Profile, and says so', async () => {
    const aiSession = createFakeAiSession(CV_RUN, CV_RUN);
    const { actions, profileDirectory } = await openProfile(aiSession);
    writeFileSync(path.join(profileDirectory, 'cv.md'), '# Mon CV corrigé à la main\n');
    await actions.saveUpload({ candidateId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    await actions.runQueuedJobs();

    expect(readFileSync(path.join(profileDirectory, 'cv.md'), 'utf8')).toBe('# Mon CV corrigé à la main\n');
    const failure = await conversionOf(actions);
    expect(failure?.state).toBe('failed');
    expect(failure?.log).toContain(
      "« cv.pdf » se convertit en « cv.md », que le Profil a déjà : il n'est pas écrasé. Supprimer ou renommer « cv.md », puis relancer la conversion.",
    );

    await actions.deleteProfileFile({ candidateId: 'lea', fileName: 'cv.md' });
    await actions.convertUpload({ candidateId: 'lea', fileName: 'cv.pdf' });
    await actions.runQueuedJobs();

    expect(readFileSync(path.join(profileDirectory, 'cv.md'), 'utf8')).toBe(CV_MARKDOWN);
    expect(await conversionOf(actions)).toMatchObject({ state: 'ready' });
  });

  it('shows why a conversion failed, and runs it again when relaunched', async () => {
    const aiSession = createFakeAiSession({ isSuccess: false }, { fileByName: { 'notes.md': '# Notes\n' } }, CV_RUN);
    const { actions } = await openProfile(aiSession);
    await actions.saveUpload({ candidateId: 'lea', fileName: 'cv.pdf', content: CV_PDF });

    await actions.runQueuedJobs();
    const sessionFailure = await conversionOf(actions);
    expect(sessionFailure?.state).toBe('failed');
    expect(sessionFailure?.log).toContain('Claude Code a rencontré une erreur.');
    await actions.convertUpload({ candidateId: 'lea', fileName: 'cv.pdf' });
    await actions.runQueuedJobs();
    const nameFailure = await conversionOf(actions);
    expect(nameFailure?.state).toBe('failed');
    expect(nameFailure?.log).toContain(
      "« notes.md » n'est ni « cv.md » ni une lettre « lettre-<employeur>-<année>.md »",
    );
    await actions.convertUpload({ candidateId: 'lea', fileName: 'cv.pdf' });
    await actions.runQueuedJobs();

    expect(await conversionOf(actions)).toMatchObject({ state: 'ready' });
    expect(await profileFileNameListOf(actions)).toEqual(['cv.md', 'facts.md']);
  });

  it('refuses to convert an Upload the Profile does not have', async () => {
    const { actions } = await openProfile(createFakeAiSession());

    await expect(actions.convertUpload({ candidateId: 'lea', fileName: 'cv.pdf' })).rejects.toThrow(
      "Le Profil de Léa n'a pas de Pièce « cv.pdf »",
    );
  });

  it('fails the conversion of an Upload deleted while it waited', async () => {
    const aiSession = createFakeAiSession(CV_RUN);
    const { actions } = await openProfile(aiSession);
    await actions.saveUpload({ candidateId: 'lea', fileName: 'cv.pdf', content: CV_PDF });
    await actions.deleteUpload({ candidateId: 'lea', fileName: 'cv.pdf' });

    const [job] = await actions.runQueuedJobs();

    expect(job?.state).toBe('failed');
    expect(job?.log).toContain("« cv.pdf » n'est plus dans le Profil");
    expect(aiSession.headlessSessionList).toEqual([]);
  });
});
