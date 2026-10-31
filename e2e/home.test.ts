import { expect, test, type Page } from '@playwright/test';

import { findOverflowing } from './overflow.ts';

// test/seed-front.ts gives Léa the 9 To Apply Postings of her Zone, the courts of appeal of Douai and
// Amiens, from one Detection; no e2e test changes them. Camille has no Watch, hence no Posting.
const BETHUNE_TITLE = 'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE';

async function chooseCandidate(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption(name);
  await page.getByRole('button', { name: 'Choisir' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Bonjour ${name}`);
}

function findLatestPostings(page: Page) {
  return page.getByRole('region', { name: 'Dernières Offres' });
}

test.describe('home', () => {
  // The tiles of the map come from OpenStreetMap over the internet: its points show without them
  test.beforeEach(async ({ page }) => {
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  });

  test('shows the 6 latest Postings of the Zone as tiles, and the same ones on the map', async ({ page }) => {
    await chooseCandidate(page, 'Léa');

    const latestPostings = findLatestPostings(page);
    const tileList = latestPostings.getByRole('article');
    await expect(tileList).toHaveCount(6);
    await expect(latestPostings.locator('.posting-map__point')).toHaveCount(6);
    const bethune = tileList.filter({ has: page.getByRole('link', { name: BETHUNE_TITLE }) });
    await expect(bethune.getByRole('link', { name: BETHUNE_TITLE })).toHaveAttribute('href', '/postings/2026-2445600');
    await expect(bethune).toContainText("Cour d'Appel de Douai");
    await expect(bethune).toContainText('Béthune');
    await expect(bethune.getByRole('definition')).toHaveText(['20/11/2026', '20/10/2026']);
    await expect(bethune.getByText('Expirée')).toHaveCount(0);
  });

  test('leads to every Posting, from the home and from the menu', async ({ page }) => {
    await chooseCandidate(page, 'Léa');

    await findLatestPostings(page).getByRole('link', { name: 'Toutes les Offres' }).click();
    await expect(page).toHaveURL('/postings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Léa');

    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Accueil' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bonjour Léa');
    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Offres' }).click();
    await expect(page).toHaveURL('/postings');
  });

  test('says when no Posting arrived in the Zone yet', async ({ page }) => {
    await chooseCandidate(page, 'Camille');

    await expect(findLatestPostings(page).getByRole('article')).toHaveCount(0);
    await expect(findLatestPostings(page)).toContainText('Aucune Offre à traiter dans votre Zone pour l’instant');
  });

  test('fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await chooseCandidate(page, 'Léa');
    await expect(findLatestPostings(page).getByRole('article')).toHaveCount(6);

    await expect.poll(() => findOverflowing(page)).toEqual([]);
  });

  test('asks who is there before showing any Posting', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qui consulte ses Offres ?');
    await expect(page.getByRole('article')).toHaveCount(0);
  });
});
