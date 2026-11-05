import type { Locator, Page } from '@playwright/test';
import { z } from 'zod/v4';

import { expect, test, type IFront } from './candidate.ts';
import { openDatabase } from './harness.ts';

// Nora's six imported Postings (test/seed-front.ts), in the order the seed imported them, as this file
// places and sorts them: four To Apply, one To Apply Archived, one New
const IRIS_POSTING_LIST = [
  { city: 'Lille', region: 'Hauts-de-France', latitude: 50.63, longitude: 3.06, status: 'to_apply', isArchived: false },
  { city: 'Lille', region: 'Hauts-de-France', latitude: 50.63, longitude: 3.06, status: 'to_apply', isArchived: false },
  { city: 'Arras', region: 'Hauts-de-France', latitude: 50.29, longitude: 2.78, status: 'to_apply', isArchived: false },
  {
    city: 'Lyon',
    region: 'Auvergne-Rhône-Alpes',
    latitude: 45.76,
    longitude: 4.84,
    status: 'to_apply',
    isArchived: false,
  },
  {
    city: 'Bordeaux',
    region: 'Nouvelle-Aquitaine',
    latitude: 44.84,
    longitude: -0.58,
    status: 'to_apply',
    isArchived: true,
  },
  { city: 'Rennes', region: 'Bretagne', latitude: 48.11, longitude: -1.68, status: 'new', isArchived: false },
];

function titleOf(index: number, city: string): string {
  return `Greffier placé ${String(index + 1)} – ${city}`;
}

// Nora's Postings as this file needs them, whatever a previous run left; only reading tests use them
function resetNora() {
  const database = openDatabase();
  const referenceList = z
    .array(z.object({ reference: z.string() }))
    .parse(database.prepare('SELECT "reference" FROM "Posting" WHERE "candidateId" = ? ORDER BY "id"').all('nora'));
  const update = database.prepare(
    `UPDATE "Posting" SET "title" = ?, "city" = ?, "region" = ?, "latitude" = ?, "longitude" = ?, "status" = ?,
      "archivedAt" = ? WHERE "reference" = ?`,
  );
  for (const [index, { city, region, latitude, longitude, status, isArchived }] of IRIS_POSTING_LIST.entries()) {
    update.run(
      titleOf(index, city),
      city,
      region,
      latitude,
      longitude,
      status,
      isArchived ? '2026-10-01T00:00:00.000+00:00' : null,
      z.string().parse(referenceList[index]?.reference),
    );
  }
  database.close();
}

// Yara's one Posting back New and followed, whatever a previous run left
function resetYara() {
  const database = openDatabase();
  database.prepare(`UPDATE "Posting" SET "status" = 'new', "archivedAt" = NULL WHERE "candidateId" = ?`).run('yara');
  database.close();
}

type Front = IFront & { asCandidate: (id: string) => Promise<void> };

async function open({ page, asCandidate, openPage }: Front, candidateId: string, path: string) {
  // The tiles come from OpenStreetMap over the internet: the markers show without them
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await asCandidate(candidateId);
  await openPage(path);
}

function findPanel(page: Page, name: string): Locator {
  return page.getByRole('complementary', { name });
}

function findFilters(page: Page): Locator {
  return page.getByRole('search', { name: 'Filtres' });
}

function findMarker(page: Page, city: string): Locator {
  return page
    .getByRole('region', { name: 'Carte des Offres' })
    .getByRole('button', { name: new RegExp(`^${city} · `) });
}

// The distance on screen between two markers: the closer, the wider the map's view
async function distanceBetween(first: Locator, second: Locator): Promise<number> {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  return firstBox === null || secondBox === null ? NaN : Math.hypot(firstBox.x - secondBox.x, firstBox.y - secondBox.y);
}

test.describe('The filters of a list', () => {
  test('filters by several Cities, searched, each with its count, the most frequent first', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    resetNora();
    await open({ page, asCandidate, openPage }, 'nora', '/to-apply');
    const panel = findPanel(page, 'À traiter');
    await expect(panel.getByRole('listitem')).toHaveCount(4);

    await findFilters(page).getByRole('combobox', { name: 'Ville : Toutes les villes' }).click();
    const cityList = page.getByRole('listbox');
    await expect(cityList.getByRole('option')).toHaveText([/^Lille\s*2$/, /^Arras\s*1$/, /^Lyon\s*1$/]);
    await page.getByRole('combobox', { name: 'Chercher une ville…' }).fill('ly');
    await expect(cityList.getByRole('option')).toHaveText([/^Lyon/]);
    await cityList.getByRole('option', { name: /^Lyon/ }).click();
    await page.getByRole('combobox', { name: 'Chercher une ville…' }).fill('');
    await cityList.getByRole('option', { name: /^Arras/ }).click();
    await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/\/to-apply\?city=Lyon&city=Arras$/);
    await expect(findFilters(page).getByRole('combobox', { name: 'Ville : 2 villes' })).toBeVisible();
    // Without a Deadline, both sit in one group, in an order this test leaves aside
    await expect(panel.getByRole('listitem')).toHaveCount(2);
    await expect(panel.getByRole('listitem').filter({ hasText: /^Arras/ })).toBeVisible();
    await expect(panel.getByRole('listitem').filter({ hasText: /^Lyon/ })).toBeVisible();
    await expect(findMarker(page, 'Lille')).toHaveCount(0);

    // The filters live in the URL: the page opened again keeps them
    await openPage('/to-apply?city=Lyon&city=Arras');
    await expect(panel.getByRole('listitem')).toHaveCount(2);
    await findFilters(page).getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(panel.getByRole('listitem')).toHaveCount(4);
  });

  test('filters by Region, the map fitting the whole Region rather than its Postings', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    resetNora();
    // Lille and Arras alone: the map fits them, close up
    await open({ page, asCandidate, openPage }, 'nora', '/to-apply?city=Lille&city=Arras');
    const arras = findMarker(page, 'Arras');
    const lille = findMarker(page, 'Lille').first();
    await expect.poll(() => distanceBetween(arras, lille)).toBeGreaterThan(200);

    await findFilters(page).getByRole('combobox', { name: 'Région' }).selectOption('Hauts-de-France');

    await expect(page).toHaveURL(/region=Hauts-de-France/);
    await expect(findPanel(page, 'À traiter').getByRole('listitem')).toHaveCount(3);
    // The whole Region in view: the two Cities, 40 km apart, close together
    await expect.poll(() => distanceBetween(arras, lille)).toBeLessThan(150);
    await expect(findFilters(page).getByRole('combobox', { name: 'Région' }).getByRole('option')).toHaveText([
      'Toutes les régions',
      'Auvergne-Rhône-Alpes (1)',
      'Hauts-de-France (3)',
    ]);
  });

  test('shows the Archived Postings of the list instead of the followed ones', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    resetNora();
    await open({ page, asCandidate, openPage }, 'nora', '/to-apply');
    const archived = findFilters(page).getByRole('button', { name: /^Archivées/ });
    await expect(archived).toHaveText(/1$/);

    await archived.click();

    await expect(page).toHaveURL(/\/to-apply\?archived=on$/);
    await expect(archived).toHaveAttribute('aria-pressed', 'true');
    await expect(findPanel(page, 'À traiter').getByRole('listitem')).toHaveText([/^Bordeaux/]);
    await archived.click();
    await expect(findPanel(page, 'À traiter').getByRole('listitem')).toHaveCount(4);
  });

  // Léa's Archived Application (test/seed-front.ts), which no test changes
  test('shows the Archived Applications, keeping the tab', async ({ page, asCandidate, openPage }) => {
    await open({ page, asCandidate, openPage }, 'lea', '/applications');
    const panel = findPanel(page, 'Candidatures');
    const archivedRow = panel.getByRole('listitem').filter({ hasText: 'Postulée · archivée' });
    await expect(panel.getByRole('listitem')).not.toHaveCount(0);
    await expect(archivedRow).toHaveCount(0);

    await findFilters(page)
      .getByRole('button', { name: /^Archivées/ })
      .click();

    await expect(page).toHaveURL(/\/applications\?archived=on$/);
    await expect(archivedRow).toHaveCount(1);
    await expect(panel.getByRole('listitem').filter({ hasNotText: '· archivée' })).toHaveCount(0);
  });

  test('finds a dismissed New Posting under Archived, which comes back New once unarchived', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    resetYara();
    await open({ page, asCandidate, openPage }, 'yara', '/');
    const panel = findPanel(page, 'Nouvelles');
    await panel.getByRole('button', { name: 'Écarter' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Offre écartée' })).toBeVisible();
    await expect(panel).toContainText('Rien à trier.');

    await findFilters(page)
      .getByRole('button', { name: /^Archivées/ })
      .click();

    const row = panel.getByRole('listitem').filter({ hasText: 'greffier-yara.md' });
    await expect(row).toBeVisible();
    // Dismissed already: nothing left to sort
    await expect(row.getByRole('button', { name: 'Garder' })).toHaveCount(0);
    await row.getByRole('link', { name: 'greffier-yara.md' }).click();
    const header = page.locator('main > header');
    await expect(header.locator('[data-step]')).toHaveText('Nouvelle · archivée');
    await header.getByRole('button', { name: 'Désarchiver' }).click();
    await expect(header.locator('[data-step]')).toHaveText('Nouvelle');

    await openPage('/');
    await expect(panel.getByRole('listitem').filter({ hasText: 'greffier-yara.md' })).toBeVisible();
    await expect(findFilters(page).getByRole('button', { name: /^Archivées/ })).toHaveText(/0$/);
  });
});
