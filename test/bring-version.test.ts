import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';

import { applyTo } from './apply.ts';
import { detectPostings as detectRecordedPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { runAndValidate } from './run-module.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RESEARCH_RUN = { fileByName: { 'research.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } };

const MY_RESEARCH = '# Ma Recherche\n\nLe tribunal pour enfants de Béthune juge les mineurs.\n';
const MY_LETTER = 'Madame la Présidente,\n\nJe souhaite rejoindre le tribunal.\n';

const LETTER_PDF = new Uint8Array(readFileSync(path.join(import.meta.dirname, 'fixtures/profile/cv.pdf')));

async function detectPostings(...plannedRunList: Parameters<typeof createFakeAiSession>) {
  const aiSession = createFakeAiSession(...plannedRunList);
  const { actions } = await detectRecordedPostings(aiSession);
  return { actions, aiSession };
}

// Each Version as the Posting page reads it
async function readVersions(actions: Actions, artifact: string) {
  const { artifactList } = await actions.readPosting({ reference: REFERENCE });
  return artifactList
    .find((artifactVersions) => artifactVersions.artifact === artifact)
    ?.versionList.map(({ version, text, original, isValidatable }) => ({
      number: version.number,
      state: version.state,
      validation: version.validation,
      origin: version.origin,
      text,
      original,
      isValidatable,
    }));
}

describe('bringing a Version of my own', () => {
  it('lands a pasted Research as a Draft after the AI Versions, with no Original', async () => {
    const { actions } = await detectPostings(RESEARCH_RUN);
    await runAndValidate(actions, { module: 'research', reference: REFERENCE });

    await actions.bringVersion({ reference: REFERENCE, artifact: 'research', markdown: MY_RESEARCH });

    expect(await readVersions(actions, 'research')).toEqual([
      expect.objectContaining({ number: 1, origin: 'ai', validation: 'validated' }),
      {
        number: 2,
        state: 'ready',
        validation: 'draft',
        origin: 'candidate',
        text: MY_RESEARCH,
        original: null,
        isValidatable: true,
      },
    ]);
  });

  it('brings a Letter with no Research, since nothing is generated', async () => {
    const { actions } = await detectPostings();

    await actions.bringVersion({ reference: REFERENCE, artifact: 'letter', markdown: MY_LETTER });

    expect(await readVersions(actions, 'letter')).toEqual([
      expect.objectContaining({ number: 1, origin: 'candidate', validation: 'draft', text: MY_LETTER }),
    ]);
  });

  it('refuses an empty text', async () => {
    const { actions } = await detectPostings();

    await expect(
      actions.bringVersion({ reference: REFERENCE, artifact: 'research', markdown: ' \n' }),
    ).rejects.toMatchObject({ code: 'empty_brought_version' });
  });

  // The Letter sent is the one recorded: nothing replaces it once the Posting is Applied
  it('refuses a Letter, pasted or as a PDF, once the Posting is Applied', async () => {
    const { actions } = await detectPostings();
    await applyTo(actions, REFERENCE);

    await expect(
      actions.bringVersion({ reference: REFERENCE, artifact: 'letter', markdown: MY_LETTER }),
    ).rejects.toMatchObject({ code: 'letter_frozen' });
    await expect(
      actions.bringPdf({ reference: REFERENCE, artifact: 'letter', content: LETTER_PDF }),
    ).rejects.toMatchObject({ code: 'letter_frozen' });
    expect(await readVersions(actions, 'letter')).toEqual([]);
  });

  // A PDF is converted like an Upload, by the worker (ADR-0003): it reads the PDF and writes the Version's text
  it('converts a PDF into a Draft of my own, with no Original', async () => {
    const { actions, aiSession } = await detectPostings({ fileByName: { 'letter.md': MY_LETTER } });

    await actions.bringPdf({ reference: REFERENCE, artifact: 'letter', content: LETTER_PDF });
    const [running] = (await readVersions(actions, 'letter')) ?? [];
    await actions.runQueuedJobs();

    expect(running).toBeUndefined();
    const [session] = aiSession.headlessSessionList;
    expect(session).toMatchObject({ isReadingDirectory: true, isSearchingWeb: false });
    expect(session?.fixedPrompt).toContain('brought.pdf');
    expect(await readVersions(actions, 'letter')).toEqual([
      {
        number: 1,
        state: 'ready',
        validation: 'draft',
        origin: 'candidate',
        text: MY_LETTER,
        original: null,
        isValidatable: true,
      },
    ]);
  });

  it('refuses a file that is not a PDF', async () => {
    const { actions } = await detectPostings();

    await expect(
      actions.bringPdf({ reference: REFERENCE, artifact: 'research', content: new TextEncoder().encode(MY_RESEARCH) }),
    ).rejects.toMatchObject({ code: 'not_a_pdf' });
  });
});
