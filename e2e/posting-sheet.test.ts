import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Locator, Page } from '@playwright/test';
import { z } from 'zod/v4';

import { expect, test, type IFront } from './candidate.ts';

// How long a raw write waits for the server's own writes to release the database
const BUSY_TIMEOUT_MS = 5000;

// The Postings of test/seed-front.ts this file owns, in their import order: their City, its
// coordinates and the Status each test starts from
const PLACE_LIST_BY_CANDIDATE = {
  sia: [
    { city: 'Arras', latitude: 50.29, longitude: 2.78, status: 'to_apply' },
    { city: 'Caen', latitude: 49.18, longitude: -0.37, status: 'to_apply' },
  ],
  ivo: [{ city: 'Dijon', latitude: 47.32, longitude: 5.04, status: 'to_apply' }],
  gus: [{ city: 'Brest', latitude: 48.39, longitude: -4.49, status: 'new' }],
};

type SheetCandidate = keyof typeof PLACE_LIST_BY_CANDIDATE;

// Every imported Posting of the seed has the same title, which also names its folder: the employer
// tells them apart
function employerOf(city: string): string {
  return `Cour d’appel de ${city}`;
}

// The Candidate's Postings as this file needs them, whatever a previous run left; their references
// come back, by City
function resetPostings(candidateId: SheetCandidate): Map<string, string> {
  const { dataDirectory } = z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata);
  const database = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { timeout: BUSY_TIMEOUT_MS });
  const referenceList = z
    .array(z.object({ reference: z.string() }))
    .parse(
      database.prepare('SELECT "reference" FROM "Posting" WHERE "candidateId" = ? ORDER BY "id"').all(candidateId),
    );
  const update = database.prepare(
    `UPDATE "Posting" SET "employer" = ?, "city" = ?, "region" = NULL, "latitude" = ?,
      "longitude" = ?, "deadline" = NULL, "startDate" = NULL, "status" = ?, "appliedAt" = NULL,
      "archivedAt" = NULL, "notes" = '' WHERE "reference" = ?`,
  );
  const referenceByCity = new Map<string, string>();
  const placeList = PLACE_LIST_BY_CANDIDATE[candidateId];
  for (const [index, { city, latitude, longitude, status }] of placeList.entries()) {
    const reference = z.string().parse(referenceList[index]?.reference);
    update.run(employerOf(city), city, latitude, longitude, status, reference);
    referenceByCity.set(city, reference);
  }
  database.close();
  return referenceByCity;
}

async function openListOf(
  { page, asCandidate, openPage }: IFront & { asCandidate: (id: string) => Promise<void> },
  candidateId: SheetCandidate,
  listPath: string,
) {
  // The tiles come from OpenStreetMap over the internet: the markers show without them
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const referenceByCity = resetPostings(candidateId);
  await asCandidate(candidateId);
  await openPage(listPath);
  return referenceByCity;
}

function findSheet(page: Page): Locator {
  return page.getByRole('dialog');
}

function findRow(page: Page, city: string): Locator {
  return page
    .getByRole('complementary')
    .getByRole('listitem')
    .filter({ hasText: employerOf(city) });
}

// The Sheet shows the Posting of that City, its employer under its title
async function expectSheetOf(page: Page, city: string) {
  await expect(findSheet(page).locator('[data-slot="sheet-description"]')).toHaveText(employerOf(city));
}

function findMarker(page: Page, city: string): Locator {
  return page
    .getByRole('region', { name: 'Carte des Offres' })
    .getByRole('button', { name: new RegExp(`^${city} · `) });
}

// On its City line: the title in the middle of the row opens the Posting's page instead
async function openFromRow(page: Page, city: string) {
  await findRow(page, city)
    .getByRole('button', { name: 'Aperçu de cette Offre' })
    .click({ position: { x: 8, y: 8 } });
}

test.describe('The Posting Sheet', () => {
  test('opens from a row with the facts first, lives in the URL, and swaps its Posting in place', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    const referenceByCity = await openListOf({ page, asCandidate, openPage }, 'sia', '/to-apply');
    const arras = z.string().parse(referenceByCity.get('Arras'));
    const caen = z.string().parse(referenceByCity.get('Caen'));

    await openFromRow(page, 'Arras');

    const sheet = findSheet(page);
    await expectSheetOf(page, 'Arras');
    await expect(page).toHaveURL(`/to-apply?posting=${arras}`);
    // Top to bottom: title, employer, City, Deadline, Start Date and Step
    await expect(sheet).toContainText(
      /greffier-arras\.md\s*Cour d’appel de Arras\s*Arras\s*Sans date limite\s*Prise de poste non précisée\s*À traiter/,
    );
    await expect(sheet.getByRole('button', { name: 'Marquer Postulée' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: /^Recherche/ })).toContainText('Pas encore');
    await expect(sheet.getByRole('heading', { name: 'Fiche de poste' })).toBeVisible();
    await expect(sheet).toContainText('Tenir les audiences du tribunal.');
    await expect(sheet.getByRole('link', { name: 'Ouvrir la page complète' })).toHaveAttribute(
      'href',
      `/postings/${arras}`,
    );

    // The list stays usable: another row shows its Posting in the same Sheet
    await openFromRow(page, 'Caen');
    await expectSheetOf(page, 'Caen');
    await expect(findSheet(page)).toHaveCount(1);
    // Away from the row, whose hover would outshine the marker it made active
    await page.mouse.move(0, 0);
    await expect(findMarker(page, 'Caen')).toHaveAttribute('data-highlight', 'active');

    // Back shows the previous Posting again, then none
    await page.goBack();
    await expectSheetOf(page, 'Arras');
    await page.goBack();
    await expect(findSheet(page)).toBeHidden();

    // A link opens it
    await openPage(`/to-apply?posting=${caen}`);
    await expectSheetOf(page, 'Caen');
    await findSheet(page).getByRole('button', { name: 'Fermer' }).click();
    await expect(findSheet(page)).toBeHidden();
    await expect(page).toHaveURL(/\/to-apply$/);
  });

  test('opens from a marker, and keeps a New Posting from its Sheet', async ({ page, asCandidate, openPage }) => {
    await openListOf({ page, asCandidate, openPage }, 'gus', '/');

    await findMarker(page, 'Brest').click();

    const sheet = findSheet(page);
    await expectSheetOf(page, 'Brest');
    await expect(sheet.locator('[data-step]')).toHaveText('Nouvelle');
    await sheet.getByRole('button', { name: 'Garder' }).click();
    await expect(page.getByText('Offre gardée : sa Recherche est lancée')).toBeVisible();
    // It leaves New, its Sheet stays open on its new Step
    await expect(findRow(page, 'Brest')).toHaveCount(0);
    await expect(sheet.locator('[data-step]')).toHaveText('À traiter');
    await expect(sheet.getByRole('button', { name: 'Marquer Postulée' })).toBeVisible();
  });

  test('offers the actions of each Step, and keeps the Notes in place, shown on the Notes tab', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    const referenceByCity = await openListOf({ page, asCandidate, openPage }, 'ivo', '/to-apply');
    const dijon = z.string().parse(referenceByCity.get('Dijon'));
    await openFromRow(page, 'Dijon');
    const sheet = findSheet(page);

    // Notes edited in place
    const notes = 'Rappeler le greffe lundi.';
    const editor = sheet.getByRole('textbox', { name: 'Notes en Markdown' });
    await editor.fill(notes);
    await sheet.getByRole('button', { name: 'Enregistrer les Notes' }).click();
    await expect(page.getByText('Notes enregistrées')).toBeVisible();

    // To Apply → Applied: the outcomes come
    await sheet.getByRole('button', { name: 'Marquer Postulée' }).click();
    await expect(sheet.locator('[data-step]')).toHaveText('Postulée');
    await expect(findRow(page, 'Dijon')).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Refusée' }).click();
    await expect(sheet.locator('[data-step]')).toHaveText('Refusée');
    await expect(sheet.getByRole('button', { name: 'Remettre en cours' })).toBeVisible();

    // Archived, it keeps its Step
    await sheet.getByRole('button', { name: 'Archiver' }).click();
    await expect(sheet.locator('[data-step]')).toHaveText('Refusée · archivée');
    await expect(sheet.getByRole('button', { name: 'Désarchiver' })).toBeVisible();

    await sheet.getByRole('link', { name: 'Ouvrir la page complète' }).click();
    await expect(page).toHaveURL(`/postings/${dijon}`);
    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(page.getByRole('textbox', { name: 'Notes en Markdown' })).toHaveValue(notes);
  });
});
