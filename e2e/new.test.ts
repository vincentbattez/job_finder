import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Locator, Page } from '@playwright/test';
import { z } from 'zod/v4';

import { expect, test, type IFront } from './candidate.ts';

// How long a raw write waits for the server's own writes to release the database
const BUSY_TIMEOUT_MS = 5000;

// Ana, Eli and Tom each have one Posting of test/seed-front.ts, which only one test here sorts
type Sorter = 'ana' | 'eli' | 'tom';

function titleOf(candidateId: Sorter): string {
  return `greffier-${candidateId}.md`;
}

// The Candidate's one Posting back New, followed, whatever a previous run left: keeping it is never
// undone through the front. Its reference comes back for the page.
function resetToNew(candidateId: Sorter): string {
  const { dataDirectory } = z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata);
  const database = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { timeout: BUSY_TIMEOUT_MS });
  database
    .prepare(`UPDATE "Posting" SET "status" = 'new', "archivedAt" = NULL WHERE "candidateId" = ?`)
    .run(candidateId);
  const { reference } = z
    .object({ reference: z.string() })
    .parse(database.prepare('SELECT "reference" FROM "Posting" WHERE "candidateId" = ?').get(candidateId));
  database.close();
  return reference;
}

async function openNewOf(
  { page, asCandidate, openPage }: IFront & { asCandidate: (id: string) => Promise<void> },
  candidateId: Sorter,
) {
  // The tiles come from OpenStreetMap over the internet: the list shows without them
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const reference = resetToNew(candidateId);
  await asCandidate(candidateId);
  await openPage('/');
  return reference;
}

function findPanel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Nouvelles' });
}

function findRow(page: Page, candidateId: Sorter): Locator {
  return findPanel(page)
    .getByRole('listitem')
    .filter({ hasText: titleOf(candidateId) });
}

function findNewLink(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Pages' }).getByRole('listitem').filter({ hasText: 'Nouvelles' });
}

test.describe('New', () => {
  test('opens at /, then keeps a Posting from its row, which leaves the list at once and moves To Apply', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await openNewOf({ page, asCandidate, openPage }, 'ana');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nouvelles');
    await expect(page.locator('main > header')).toContainText('1 à trier : garde-la ou écarte-la');
    await expect(findNewLink(page)).toContainText('1 Offre à trier');

    await findRow(page, 'ana').getByRole('button', { name: 'Garder' }).click();

    await expect(findRow(page, 'ana')).toHaveCount(0);
    await expect(page.getByText('Offre gardée : sa Recherche est lancée')).toBeVisible();
    await expect(findNewLink(page)).not.toContainText('à trier');
    await expect(findPanel(page)).toContainText('Rien à trier.');
    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'À traiter' }).click();
    await expect(page.getByRole('complementary', { name: 'À traiter' })).toContainText(titleOf('ana'));
  });

  test('dismisses a Posting from its row, then brings it back with « Annuler »', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await openNewOf({ page, asCandidate, openPage }, 'eli');

    await findRow(page, 'eli').getByRole('button', { name: 'Écarter' }).click();

    await expect(findRow(page, 'eli')).toHaveCount(0);
    const toast = page.getByRole('listitem').filter({ hasText: 'Offre écartée' });
    await expect(toast).toBeVisible();
    await toast.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByText('Offre remise dans les Nouvelles')).toBeVisible();
    await expect(findRow(page, 'eli')).toBeVisible();
  });

  test('keeps a New Posting from its page, dismissing sitting in the ⋯ menu', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    const reference = await openNewOf({ page, asCandidate, openPage }, 'tom');
    await openPage(`/postings/${reference}`);
    const header = page.locator('main > header');
    await expect(header.locator('[data-step]')).toHaveText('Nouvelle');
    await header.getByRole('button', { name: 'Plus d’actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Écarter' })).toBeVisible();
    await page.keyboard.press('Escape');

    await header.getByRole('button', { name: 'Garder' }).click();

    await expect(page.getByText('Offre gardée : sa Recherche est lancée')).toBeVisible();
    await expect(header.locator('[data-step]')).toHaveText('À traiter');
    await expect(header.getByRole('button', { name: 'Marquer Postulée' })).toBeVisible();
  });
});
