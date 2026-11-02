import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Locator, Page } from '@playwright/test';
import { z } from 'zod/v4';

import { expect, test, type IFront } from './candidate.ts';

// How long a raw write waits for the server's own writes to release the database
const BUSY_TIMEOUT_MS = 5000;
const DAY_MS = 86_400_000;
const PARIS_DAY_FORMAT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' });

// Mila's six imported Postings (test/seed-front.ts), in the order the seed imported them, as this file
// places and dates them: a Deadline counted in days from today in Paris, null for none
const POSTING_LIST = [
  { city: 'Lille', latitude: 50.63, longitude: 3.06, days: 3, isUnpublished: false },
  { city: 'Lyon', latitude: 45.76, longitude: 4.84, days: 20, isUnpublished: false },
  { city: 'Bordeaux', latitude: 44.84, longitude: -0.58, days: 60, isUnpublished: false },
  { city: 'Rennes', latitude: 48.11, longitude: -1.68, days: null, isUnpublished: false },
  { city: 'Nice', latitude: 43.7, longitude: 7.27, days: -5, isUnpublished: true },
  { city: 'Strasbourg', latitude: 48.57, longitude: 7.75, days: 1, isUnpublished: false },
];

// A day from today in Paris, as Prisma stores a Deadline: midnight UTC
function dayFromToday(days: number): string {
  const today = Date.parse(PARIS_DAY_FORMAT.format(new Date()));
  return new Date(today + days * DAY_MS).toISOString().replace('Z', '+00:00');
}

// Mila's Postings as this file needs them, To Apply and followed, whatever a previous run left
function resetMila() {
  const { dataDirectory } = z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata);
  const database = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { timeout: BUSY_TIMEOUT_MS });
  const referenceList = z
    .array(z.object({ reference: z.string() }))
    .parse(database.prepare('SELECT "reference" FROM "Posting" WHERE "candidateId" = ? ORDER BY "id"').all('mila'));
  const update = database.prepare(
    `UPDATE "Posting" SET "title" = ?, "employer" = ?, "city" = ?, "region" = NULL, "latitude" = ?,
      "longitude" = ?, "deadline" = ?, "startDate" = ?, "unpublishedAt" = ?, "status" = 'to_apply',
      "archivedAt" = NULL WHERE "reference" = ?`,
  );
  for (const [index, { city, latitude, longitude, days, isUnpublished }] of POSTING_LIST.entries()) {
    update.run(
      `Greffier placé – Tribunal judiciaire de ${city}`,
      `Cour d’appel de ${city}`,
      city,
      latitude,
      longitude,
      days === null ? null : dayFromToday(days),
      days === null ? null : dayFromToday(days + 90),
      isUnpublished ? dayFromToday(-1) : null,
      z.string().parse(referenceList[index]?.reference),
    );
  }
  database.close();
}

async function openToApplyOfMila({
  page,
  asCandidate,
  openPage,
}: IFront & { asCandidate: (id: string) => Promise<void> }) {
  // The tiles come from OpenStreetMap over the internet: the markers show without them
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  resetMila();
  await asCandidate('mila');
  await openPage('/to-apply');
}

function findMap(page: Page): Locator {
  return page.getByRole('region', { name: 'Carte des Offres' });
}

function findMarker(page: Page, city: string): Locator {
  return findMap(page).getByRole('button', { name: new RegExp(`^${city} · `) });
}

function findRow(page: Page, city: string): Locator {
  return page.getByRole('listitem').filter({ hasText: `Greffier placé – Tribunal judiciaire de ${city}` });
}

test.describe('To Apply on the map', () => {
  test('groups the To Apply Postings by the urgency of their Deadline, each group in its order', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await openToApplyOfMila({ page, asCandidate, openPage });

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('À traiter');
    const panel = page.getByRole('complementary', { name: 'À traiter' });
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText([
      /^Cette semaine/,
      /^Dans le mois/,
      /^Plus tard/,
      /^Sans date limite/,
      /^Encore possible \?/,
    ]);
    // The City leads each row
    await expect(panel.getByRole('region', { name: 'Cette semaine' }).getByRole('listitem')).toHaveText([
      /^Strasbourg/,
      /^Lille/,
    ]);
    await expect(panel.getByRole('region', { name: 'Encore possible ?' }).getByRole('listitem')).toHaveText([/^Nice/]);
    const lille = findRow(page, 'Lille');
    await expect(lille).toContainText('dans 3 j');
    await expect(lille).toContainText('Prise de poste');
    await expect(lille.getByLabel('Recherche : pas encore')).toBeVisible();
    await expect(lille.getByLabel('Lettre de motivation : pas encore')).toBeVisible();
    await expect(findRow(page, 'Nice')).toContainText('Expirée');
    await expect(findRow(page, 'Nice')).toContainText('Dépubliée');

    // A marker per Posting, in its group's color, which the legend names
    await expect(
      findMap(page).getByRole('button', { name: /^(Lille|Lyon|Bordeaux|Rennes|Nice|Strasbourg) · / }),
    ).toHaveCount(6);
    await expect(findMarker(page, 'Lyon')).toHaveAttribute('data-group', 'month');
    await expect(page.getByRole('list', { name: 'Légende' }).getByRole('listitem')).toHaveText([
      'Cette semaine',
      'Dans le mois',
      'Plus tard',
      'Sans date ou passée',
    ]);

    // The list folds away over the map, and comes back
    await panel.getByRole('button', { name: 'Replier la liste' }).click();
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: 'À traiter · 6' }).click();
    await expect(panel).toBeVisible();
  });

  test('keeps the rows and the markers in step both ways', async ({ page, asCandidate, openPage }) => {
    await openToApplyOfMila({ page, asCandidate, openPage });

    await findRow(page, 'Lyon').hover();
    await expect(findMarker(page, 'Lyon')).toHaveAttribute('data-highlight', 'hover');
    await expect(findMap(page).getByRole('tooltip')).toHaveText(/^Lyon · /);

    await findMarker(page, 'Bordeaux').hover();
    await expect(findRow(page, 'Bordeaux')).toHaveAttribute('data-highlighted', '');
    await expect(findRow(page, 'Bordeaux')).toBeInViewport();
    await expect(findRow(page, 'Lyon')).not.toHaveAttribute('data-highlighted', '');
  });

  test('centers the map on the marker of a clicked item, beside the list', async ({ page, asCandidate, openPage }) => {
    await openToApplyOfMila({ page, asCandidate, openPage });
    const panelBox = await page.getByRole('complementary', { name: 'À traiter' }).boundingBox();
    const mapBox = await findMap(page).boundingBox();
    if (panelBox === null || mapBox === null) {
      throw new Error('The list and the map show');
    }
    // The part of the map the list leaves visible
    const visibleCenterX = (panelBox.x + panelBox.width + mapBox.x + mapBox.width) / 2;
    const visibleCenterY = mapBox.y + mapBox.height / 2;

    // On its City line: the title in the middle of the row opens the Posting instead
    await findRow(page, 'Rennes')
      .getByRole('button', { name: 'Voir sur la carte' })
      .click({ position: { x: 8, y: 8 } });
    // Away from the row, whose hover would outshine the marker it made active
    await page.mouse.move(0, 0);

    await expect
      .poll(async () => {
        const markerBox = await findMarker(page, 'Rennes').boundingBox();
        return markerBox === null
          ? Infinity
          : Math.hypot(
              markerBox.x + markerBox.width / 2 - visibleCenterX,
              markerBox.y + markerBox.height / 2 - visibleCenterY,
            );
      })
      .toBeLessThan(20);
    await expect(findMarker(page, 'Rennes')).toHaveAttribute('data-highlight', 'active');
  });
});
