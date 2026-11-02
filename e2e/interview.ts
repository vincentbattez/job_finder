import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { expect, test, type Locator, type Page } from '@playwright/test';
import { z } from 'zod/v4';

// How long a raw write waits for the server's own writes to release the database
const BUSY_TIMEOUT_MS = 5000;

export function findInterviews(page: Page): Locator {
  return page.getByRole('region', { name: 'Entretiens' });
}

// Each test starts from an Application without any Interview, whatever a previous run left: deleting an
// Interview deletes its Interview Brief too
export async function deleteEveryInterview(page: Page): Promise<void> {
  const interviews = findInterviews(page);
  const interviewList = interviews.getByRole('article');
  while ((await interviewList.count()) > 0) {
    const count = await interviewList.count();
    const first = interviewList.first();
    await first.getByText(/^Supprimer l’Entretien \d+…$/).click();
    await first.getByRole('button', { name: /^Supprimer définitivement/ }).click();
    await expect(interviewList).toHaveCount(count - 1);
  }
}

// A detected Posting of the seed is New: put To Apply as keeping it would, without the Research keeping
// queues, which these tests produce themselves or go without (ADR-0018)
function putToApply(reference: string): void {
  const { dataDirectory } = z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata);
  const database = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { timeout: BUSY_TIMEOUT_MS });
  database
    .prepare(`UPDATE "Posting" SET "status" = 'to_apply' WHERE "reference" = ? AND "status" = 'new'`)
    .run(reference);
  database.close();
}

// The Posting page open, the Posting Applied if it was not yet, with a single Interview, freshly added:
// what an Interview Brief prepares. Gives the article of that Interview.
export async function prepareInterview(page: Page, reference: string): Promise<Locator> {
  putToApply(reference);
  // Applied as the header would, without the dialog a Letter not validated opens: Applied again keeps it
  const response = await page.request.post(`/postings/${reference}/status`, { form: { status: 'applied' } });
  expect(response.ok()).toBe(true);
  await page.goto(`/postings/${reference}?tab=interviews`);
  // A form typed in before React runs the page would be reset: wait for it
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', { timeout: 15_000 });
  await deleteEveryInterview(page);
  const newInterview = findInterviews(page).getByRole('group', { name: 'Nouvel Entretien' });
  await newInterview.getByLabel('Début').fill('2099-11-19T14:00');
  await newInterview.getByRole('textbox', { name: 'Interlocuteurs' }).fill('Mme Durand, juge des enfants');
  await newInterview.getByRole('button', { name: 'Ajouter l’Entretien' }).click();
  const interview = findInterviews(page).getByRole('article', { name: 'Entretien 1' });
  await expect(interview).toBeVisible();
  return interview;
}
