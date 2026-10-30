import { expect, test, type Page } from '@playwright/test';

// test/seed-front.ts locates Léa's Postings through API Géo's recorded responses, and gives the three
// Melun Postings, whose Deadline passed in the summer of 2026, a status each
const BETHUNE_TITLE = 'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE';

async function chooseLea(page: Page) {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Léa');
  await page.getByRole('button', { name: 'Choisir' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Léa');
}

async function filter(page: Page, { city = '', region = '' }: { city?: string; region?: string }) {
  const filters = page.getByRole('search', { name: 'Filtres' });
  await filters.getByRole('combobox', { name: 'Ville' }).selectOption(city);
  await filters.getByRole('combobox', { name: 'Région' }).selectOption(region);
  await filters.getByRole('button', { name: 'Filtrer' }).click();
}

function findPoints(page: Page) {
  return page.getByRole('region', { name: 'Carte des Offres' }).locator('.posting-point');
}

test.describe('map of the Postings', () => {
  // The tiles come from OpenStreetMap over the internet: the points show without them
  test.beforeEach(async ({ page }) => {
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  });

  test('shows a point per Posting of the list', async ({ page }) => {
    await chooseLea(page);

    // Other tests may add Postings to the shared data: the list tells how many there are now
    const postingCount = (await page.getByRole('row').count()) - 1;
    expect(postingCount).toBeGreaterThanOrEqual(80);
    await expect(findPoints(page)).toHaveCount(postingCount);
  });

  test('opens the Posting page on a click on its point', async ({ page }) => {
    await chooseLea(page);
    await filter(page, { city: 'Béthune' });
    const point = findPoints(page).and(page.getByRole('button', { name: /2026-2445600/ }));
    await expect(point).toHaveAttribute('data-status', /^(to_apply|expired)$/);

    // A click before React hydrates the page does nothing: click again until the Posting page opens
    await expect(async () => {
      await point.click({ timeout: 1000 });
      await expect(page).toHaveURL('/postings/2026-2445600', { timeout: 1000 });
    }).toPass();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(BETHUNE_TITLE);
  });

  test('colors a point by status: green when Applied even past its Deadline, red when Expired', async ({ page }) => {
    await chooseLea(page);

    await filter(page, { city: 'Melun' });

    await expect(findPoints(page).and(page.getByRole('button', { name: /2026-2285305/ }))).toHaveAttribute(
      'data-status',
      'applied',
    );
    await expect(findPoints(page).and(page.getByRole('button', { name: /2026-2316771/ }))).toHaveAttribute(
      'data-status',
      'expired',
    );
  });

  test('hides the Archived, from the list as from the map, until asked', async ({ page }) => {
    await chooseLea(page);
    await filter(page, { city: 'Melun' });
    await expect(findPoints(page)).toHaveCount(2);
    await expect(page.getByRole('row', { name: /2026-2290529/ })).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Afficher les Archivées' }).check();
    await page.getByRole('button', { name: 'Filtrer' }).click();

    await expect(findPoints(page)).toHaveCount(3);
    await expect(findPoints(page).and(page.getByRole('button', { name: /2026-2290529/ }))).toHaveAttribute(
      'data-status',
      'archived',
    );
    await expect(page.getByRole('row', { name: /2026-2290529/ })).toHaveCount(1);
  });

  test('filters the list and the map by region, then by city', async ({ page }) => {
    await chooseLea(page);

    await filter(page, { region: 'Hauts-de-France' });

    // The Postings of the courts of appeal of Douai and Amiens
    await expect(findPoints(page)).toHaveCount(9);
    await expect(page.getByRole('row')).toHaveCount(1 + 9);

    await filter(page, { city: 'Béthune', region: 'Hauts-de-France' });

    await expect(findPoints(page)).toHaveCount(3);
    await expect(page.getByRole('row')).toHaveCount(1 + 3);
    await expect(page.getByRole('row', { name: /2026-2445600/ })).toHaveCount(1);
  });
});
