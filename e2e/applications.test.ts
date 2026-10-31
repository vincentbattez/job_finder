import type { Page } from '@playwright/test';

import { expect, test, type IFront } from './candidate.ts';
import { findOverflowing } from './overflow.ts';

// test/seed-front.ts gives Léa one Posting per section that only these tests read: Hired, two Rejected whose
// outcome they change from their row, an Archived Application and a Posting archived without one
const HIRED_REFERENCE = '2026-2289933';
const REJECTED_REFERENCE = '2026-2315264';
const REJECTED_WITHOUT_JS_REFERENCE = '2026-2399015';
const ARCHIVED_REFERENCE = '2026-2340735';
const ARCHIVED_WITHOUT_APPLICATION_REFERENCE = '2026-2380466';

const SECTION_HEADING_LIST = ['En cours', 'Obtenues', 'Refusées', 'Archivées', 'Archivées sans Candidature'];

// Léa's, once asCandidate chose her
async function openApplications({ page, openPage }: IFront) {
  await openPage('/applications');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Candidatures de Léa');
}

function findSection(page: Page, heading: string) {
  return page.getByRole('region', { name: heading, exact: true });
}

function findRow(page: Page, heading: string, reference: string) {
  return findSection(page, heading)
    .getByRole('article')
    .filter({ has: page.locator(`a[href="/postings/${reference}"]`) });
}

// Puts the Application back to Rejected first, whatever a run stopped halfway left it at
async function putBackRejected(page: Page, reference: string) {
  const response = await page.request.post(`/postings/${reference}/status`, { form: { status: 'rejected' } });
  expect(response.ok()).toBe(true);
}

test.describe('/applications', () => {
  test('shows every section in order, each Posting in its own', async ({ page, asCandidate, openPage }) => {
    await putBackRejected(page, REJECTED_REFERENCE);
    await asCandidate('lea');
    await openApplications({ page, openPage });

    await expect(page.getByRole('heading', { level: 2 })).toHaveText(SECTION_HEADING_LIST);
    await expect(findRow(page, 'Obtenues', HIRED_REFERENCE).locator('.badge')).toHaveText('Obtenue');
    await expect(findRow(page, 'Refusées', REJECTED_REFERENCE).locator('.badge')).toHaveText('Refusée');
    // Archived is a mark beside the step, which it keeps (ADR-0007)
    await expect(findRow(page, 'Archivées', ARCHIVED_REFERENCE).locator('.badge')).toHaveText(['Postulée', 'Archivée']);
    const archivedWithoutApplication = findRow(
      page,
      'Archivées sans Candidature',
      ARCHIVED_WITHOUT_APPLICATION_REFERENCE,
    );
    await expect(archivedWithoutApplication.getByRole('button', { name: 'Marquer comme Postulée' })).toBeVisible();
    await expect(archivedWithoutApplication.getByRole('group', { name: 'Issue de la Candidature' })).toHaveCount(0);
  });

  test('shows an Archived Application at its step on its page too, beside the Archived badge', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await asCandidate('lea');
    await openPage(`/postings/${ARCHIVED_REFERENCE}`);

    await expect(page.locator('.posting-detail__title .badge')).toHaveText(['Postulée', 'Archivée']);
  });

  test('puts a Rejected Application back In progress from its row, staying on the page', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await putBackRejected(page, REJECTED_REFERENCE);
    await asCandidate('lea');
    await openApplications({ page, openPage });

    await findRow(page, 'Refusées', REJECTED_REFERENCE).getByRole('button', { name: 'Envoyée' }).click();

    await expect(findRow(page, 'En cours', REJECTED_REFERENCE)).toHaveCount(1);
    await expect(findRow(page, 'Refusées', REJECTED_REFERENCE)).toHaveCount(0);
    await expect(page).toHaveURL('/applications');
  });

  test('is reached from the home and from the menu', async ({ page, asCandidate, openPage }) => {
    await asCandidate('lea');
    await openPage('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bonjour Léa');

    await page.getByRole('link', { name: 'Toutes les Candidatures' }).click();
    await expect(page).toHaveURL('/applications');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Candidatures de Léa');

    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Accueil' }).click();
    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Candidatures' }).click();
    await expect(page).toHaveURL('/applications');
  });

  test('fits a phone screen', async ({ page, asCandidate, openPage }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await asCandidate('lea');
    await openApplications({ page, openPage });

    await expect.poll(() => findOverflowing(page)).toEqual([]);
  });

  test('asks who is there before showing any Application', async ({ page }) => {
    await page.goto('/applications');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qui consulte ses Candidatures ?');
    await expect(page.getByRole('article')).toHaveCount(0);
  });

  test.describe('before React runs', () => {
    test.use({ javaScriptEnabled: false });

    test('marks a Rejected Application Hired from its row through a plain form, back on the page', async ({
      page,
      asCandidate,
      openPage,
    }) => {
      await putBackRejected(page, REJECTED_WITHOUT_JS_REFERENCE);
      await asCandidate('lea');
      await openApplications({ page, openPage });

      await findRow(page, 'Refusées', REJECTED_WITHOUT_JS_REFERENCE).getByRole('button', { name: 'Obtenue' }).click();

      await expect(page).toHaveURL('/applications');
      await expect(findRow(page, 'Obtenues', REJECTED_WITHOUT_JS_REFERENCE)).toHaveCount(1);
    });
  });
});
