import { expect, test, type Page } from '@playwright/test';

// test/seed-front.ts locates Léa's Offres through API Géo's recorded responses, and gives the three
// Melun Offres, whose Date limite passed in the summer of 2026, a statut each
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
  return page.getByRole('region', { name: 'Carte des Offres' }).locator('.offre-point');
}

test.describe('map of the Offres', () => {
  // The tiles come from OpenStreetMap over the internet: the points show without them
  test.beforeEach(async ({ page }) => {
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  });

  test('shows a point per Offre of the list', async ({ page }) => {
    await chooseLea(page);

    // Other tests may add Offres to the shared data: the list tells how many there are now
    const offreCount = (await page.getByRole('row').count()) - 1;
    expect(offreCount).toBeGreaterThanOrEqual(80);
    await expect(findPoints(page)).toHaveCount(offreCount);
  });

  test('opens the fiche of an Offre on a click on its point', async ({ page }) => {
    await chooseLea(page);
    await filter(page, { city: 'Béthune' });
    const point = findPoints(page).and(page.getByRole('button', { name: /2026-2445600/ }));
    await expect(point).toHaveAttribute('data-statut', /^(a_traiter|expiree)$/);

    // A click before React hydrates the page does nothing: click again until the fiche opens
    await expect(async () => {
      await point.click({ timeout: 1000 });
      await expect(page).toHaveURL('/offres/2026-2445600', { timeout: 1000 });
    }).toPass();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(BETHUNE_TITLE);
  });

  test('colours a point by statut: green when Postulée even past its Date limite, red when Expirée', async ({
    page,
  }) => {
    await chooseLea(page);

    await filter(page, { city: 'Melun' });

    await expect(findPoints(page).and(page.getByRole('button', { name: /2026-2285305/ }))).toHaveAttribute(
      'data-statut',
      'postulee',
    );
    await expect(findPoints(page).and(page.getByRole('button', { name: /2026-2316771/ }))).toHaveAttribute(
      'data-statut',
      'expiree',
    );
  });

  test('hides the Archivées, from the list as from the map, until asked', async ({ page }) => {
    await chooseLea(page);
    await filter(page, { city: 'Melun' });
    await expect(findPoints(page)).toHaveCount(2);
    await expect(page.getByRole('row', { name: /2026-2290529/ })).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Afficher les Archivées' }).check();
    await page.getByRole('button', { name: 'Filtrer' }).click();

    await expect(findPoints(page)).toHaveCount(3);
    await expect(findPoints(page).and(page.getByRole('button', { name: /2026-2290529/ }))).toHaveAttribute(
      'data-statut',
      'archivee',
    );
    await expect(page.getByRole('row', { name: /2026-2290529/ })).toHaveCount(1);
  });

  test('filters the list and the map by region, then by city', async ({ page }) => {
    await chooseLea(page);

    await filter(page, { region: 'Hauts-de-France' });

    // The Offres of the courts of appeal of Douai and Amiens
    await expect(findPoints(page)).toHaveCount(9);
    await expect(page.getByRole('row')).toHaveCount(1 + 9);

    await filter(page, { city: 'Béthune', region: 'Hauts-de-France' });

    await expect(findPoints(page)).toHaveCount(3);
    await expect(page.getByRole('row')).toHaveCount(1 + 3);
    await expect(page.getByRole('row', { name: /2026-2445600/ })).toHaveCount(1);
  });
});
