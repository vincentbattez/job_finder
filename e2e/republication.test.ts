import { expect, test } from '@playwright/test';

// test/seed-front.ts imports the Offres of the feed recorded on 2026-10-29, among them the Boulogne
// parquet Poste published as 2026-2231960, then again as 2026-2338409
const TITLE = 'Attaché de justice affecté auprès des magistrats du parquet TJ BOULOGNE SUR MER';
const REPUBLICATION_TITLE = 'Attaché de justice affecté auprès des magistrats du parquet';

test('links a Republication to the Offre it publishes again, and back', async ({ page }) => {
  await page.goto('/offres/2026-2338409');
  await expect(page.getByRole('term').filter({ hasText: 'Republication de' })).toBeVisible();

  await page.getByRole('link', { name: '2026-2231960' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
  await expect(page.getByRole('term').filter({ hasText: 'Republiée en' })).toBeVisible();
  await page.getByRole('link', { name: '2026-2338409' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(REPUBLICATION_TITLE);
});

test('shows no link on an Offre published once', async ({ page }) => {
  await page.goto('/offres/2026-2445600');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('term').filter({ hasText: /^Republi/ })).toHaveCount(0);
});
