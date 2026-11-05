import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Page } from '@playwright/test';
import { z } from 'zod/v4';

import { expect, test } from './candidate.ts';
import { prepareApplication, runVersion } from './interview.ts';
import { findOverflowing } from './overflow.ts';

// How long a raw read waits for the server's own writes to release the database
const BUSY_TIMEOUT_MS = 5000;

// The Interview Brief the fake Claude writes, its last section renamed by the Candidate
// (test/e2e-actions.server.ts)
const RENAMED_BRIEF = [
  '# Fiche d’entretien factice',
  '## À réviser\n\n- Les missions du poste.',
  '## Moyens mnémotechniques\n\n- « MPS » : Missions, Partenaires, Service.',
  '## Présentez-vous\n\nTitulaire d’un master 2, je souhaite rejoindre votre juridiction.',
  '## Questions attendues\n\n- Pourquoi ce poste ?\n',
].join('\n\n');

function openDatabase(): DatabaseSync {
  const { dataDirectory } = z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata);
  return new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { timeout: BUSY_TIMEOUT_MS });
}

// Ruth's one Posting of test/seed-front.ts, which only this test touches
function findReference(): string {
  const database = openDatabase();
  const row = database.prepare(`SELECT "reference" FROM "Posting" WHERE "candidateId" = 'ruth'`).get();
  database.close();
  return z.object({ reference: z.string() }).parse(row).reference;
}

async function post(page: Page, url: string, form: Record<string, string>): Promise<void> {
  const response = await page.request.post(url, { form });
  expect(response.ok()).toBe(true);
}

// An Interview with a Validated Interview Brief, whatever the previous test left
async function prepareRevision(page: Page, reference: string): Promise<string> {
  await prepareApplication(page, reference);
  await post(page, `/postings/${reference}/interviews`, {
    intent: 'add',
    start: '2099-11-19T14:00',
    durationMinutes: '45',
    place: 'Tribunal judiciaire, Colmar',
    interviewers: 'Mme Klein, directrice de greffe',
  });
  await runVersion(page, { module: 'interview_brief', reference, interview: '1', number: 1 });
  await post(page, `/postings/${reference}/interview_brief/validate`, { number: '1', interview: '1' });
  return `/postings/${reference}/interviews/1/revision`;
}

// Each test prepares its own start, on the one Posting of Ruth: one after the other
test.describe.configure({ mode: 'serial' });

test('keeps notes and Mastered marks across reloads', async ({ page, openPage }) => {
  await openPage(await prepareRevision(page, findReference()));

  await expect(page.getByRole('heading', { name: 'Réviser l’Entretien 1' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'L’Entretien' })).toContainText('avant l’Entretien');
  const margin = page.getByRole('complementary', { name: 'Notes de marge' });
  const cardOf = (title: string) => margin.getByRole('listitem').filter({ hasText: title });
  await expect(page.getByText('0 sur 4 maîtrisées')).toBeVisible();
  const note = margin.getByRole('textbox', { name: 'Note de marge · Questions probables' });
  await note.fill('Parler du stage au greffe.');
  await cardOf('Questions probables').getByRole('button', { name: 'Enregistrer la note' }).click();
  await expect(page.getByText('Note de « Questions probables » enregistrée')).toBeVisible();
  // By the keyboard: the toast above covers this button until it leaves, all a click would wait for
  await margin.getByRole('button', { name: 'Maîtrisée · À réviser' }).press('Enter');
  await expect(page.getByText('« À réviser » maîtrisée')).toBeVisible();
  await expect(page.getByText('1 sur 4 maîtrisées')).toBeVisible();

  await page.reload();

  await expect(note).toHaveValue('Parler du stage au greffe.');
  await expect(margin.getByRole('button', { name: 'Maîtrisée · À réviser' })).toHaveAttribute('aria-pressed', 'true');
});

test('carries notes and Mastered marks over to a newer Chosen Interview Brief', async ({ page, openPage }) => {
  const reference = findReference();
  const revisionPath = await prepareRevision(page, reference);
  await post(page, revisionPath, { intent: 'note', title: 'Questions probables', note: 'Parler du stage au greffe.' });
  await post(page, revisionPath, { intent: 'mastered', title: 'À réviser', isMastered: 'true' });

  // A newer Draft waits: the Revision keeps the Chosen Version until it is validated
  await runVersion(page, { module: 'interview_brief', reference, interview: '1', number: 2 });
  await post(page, `/postings/${reference}/interview_brief/document`, {
    number: '2',
    interview: '1',
    fileName: 'interview-brief.md',
    markdown: RENAMED_BRIEF,
  });
  await openPage(revisionPath);
  const margin = page.getByRole('complementary', { name: 'Notes de marge' });
  const banner = page.getByRole('status').filter({ hasText: 'La Version 2, plus récente, attend ta validation.' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Relire la Version 2' }).click();
  await expect(page.getByRole('heading', { name: 'Questions attendues' })).toBeVisible();
  await page.getByRole('button', { name: 'Valider la Version 2' }).click();

  await expect(page.getByText('Version 2 validée et retenue')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Version 2' })).toHaveCount(0);
  await expect(margin.getByRole('textbox', { name: 'Note de marge · Questions attendues' })).toHaveValue('');
  await expect(margin.getByRole('button', { name: 'Maîtrisée · À réviser' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1 sur 4 maîtrisées')).toBeVisible();
  await expect(margin.getByRole('region', { name: 'Sections disparues' })).toContainText('Parler du stage au greffe.');
});

test('shows the Posting at hand in a side Sheet, and folds the rail on a phone', async ({ page, openPage }) => {
  await openPage(await prepareRevision(page, findReference()));

  await page.getByRole('button', { name: 'Offre' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Greffier – Colmar' })).toBeVisible();
  await page.keyboard.press('Escape');

  // On a phone, the rail folds into a sticky line and nothing overflows
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden();
  await expect.poll(() => findOverflowing(page)).toEqual([]);
});
