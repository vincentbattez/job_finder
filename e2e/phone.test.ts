import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Locator, Page } from '@playwright/test';
import { z } from 'zod/v4';

import { expect, test, type AsCandidate, type IFront } from './candidate.ts';
import { findOverflowing } from './overflow.ts';

// The lists on a phone (spec #125 stories 37 and 38): the map fills the screen and the list is a bottom
// drawer, pulled up from a peek to half the screen, then to all of it. Max's three To Apply Postings
// are this file's own.
const PHONE = { width: 390, height: 844 };
const HEADER_HEIGHT = 56;
const PEEK_HEIGHT = 152;
// How far from a snap point the drawer's top may settle, in pixels
const SNAP_TOLERANCE = 4;
// How long a raw write waits for the server's own writes to release the database
const BUSY_TIMEOUT_MS = 5000;
const DAY_MS = 86_400_000;

// Max's Postings, in the order the seed imported them (test/seed-front.ts)
const POSTING_LIST = [
  { city: 'Arras', latitude: 50.29, longitude: 2.78, days: 3 },
  { city: 'Caen', latitude: 49.18, longitude: -0.37, days: 40 },
  { city: 'Tours', latitude: 47.39, longitude: 0.69, days: null },
];

function dayFromToday(days: number): string {
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  return new Date(today + days * DAY_MS).toISOString().replace('Z', '+00:00');
}

// Max's Postings placed, dated and To Apply, whatever a previous run left; their employer tells them apart
function resetMax() {
  const { dataDirectory } = z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata);
  const database = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { timeout: BUSY_TIMEOUT_MS });
  const referenceList = z
    .array(z.object({ reference: z.string() }))
    .parse(database.prepare('SELECT "reference" FROM "Posting" WHERE "candidateId" = ? ORDER BY "id"').all('max'));
  const update = database.prepare(
    `UPDATE "Posting" SET "employer" = ?, "city" = ?, "region" = NULL, "latitude" = ?, "longitude" = ?,
      "deadline" = ?, "status" = 'to_apply', "archivedAt" = NULL WHERE "reference" = ?`,
  );
  for (const [index, { city, latitude, longitude, days }] of POSTING_LIST.entries()) {
    update.run(
      `Cour d’appel de ${city}`,
      city,
      latitude,
      longitude,
      days === null ? null : dayFromToday(days),
      z.string().parse(referenceList[index]?.reference),
    );
  }
  database.close();
}

async function openToApplyOnPhone({ page, asCandidate, openPage }: IFront & { asCandidate: AsCandidate }) {
  await page.setViewportSize(PHONE);
  // The tiles come from OpenStreetMap over the internet: the markers show without them
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  resetMax();
  await asCandidate('max');
  await openPage('/to-apply');
}

function findDrawer(page: Page): Locator {
  return page.getByRole('dialog', { name: /^À traiter/ });
}

// The row of Tours, the last of the list, which no scroll brings to the top without room under it
function findToursRow(page: Page): Locator {
  return findDrawer(page).getByRole('listitem').filter({ hasText: 'Cour d’appel de Tours' });
}

async function widthOf(locator: Locator): Promise<number | undefined> {
  const box = await locator.boundingBox();
  return box?.width;
}

// Where the drawer's top settles, once it stopped moving
async function expectDrawerTopAt(page: Page, top: number) {
  await expect
    .poll(async () => {
      const box = await findDrawer(page).boundingBox();
      return Math.abs((box?.y ?? Infinity) - top);
    })
    .toBeLessThan(SNAP_TOLERANCE);
}

const PEEK_TOP = PHONE.height - PEEK_HEIGHT;
// vaul moves the drawer, which stops under the header, by half the screen's height
const HALF_TOP = PHONE.height / 2 + HEADER_HEIGHT;

test.describe('The lists on a phone', () => {
  test('holds the list in a drawer over the map, which snaps to a peek, half and full', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await openToApplyOnPhone({ page, asCandidate, openPage });

    await expect(findDrawer(page)).toContainText('À traiter · 3');
    await expect(page.getByRole('complementary', { name: 'À traiter' })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Carte des Offres' })).toBeVisible();
    await expectDrawerTopAt(page, PEEK_TOP);

    await findDrawer(page).getByRole('button', { name: 'Agrandir la liste' }).click();
    await expectDrawerTopAt(page, HALF_TOP);
    await findDrawer(page).getByRole('button', { name: 'Agrandir la liste' }).click();
    await expectDrawerTopAt(page, HEADER_HEIGHT);
    await findDrawer(page).getByRole('button', { name: 'Réduire la liste' }).click();
    await expectDrawerTopAt(page, PEEK_TOP);

    // Dragged by its head, as a finger would, it settles at the nearest snap point
    const title = findDrawer(page).getByRole('heading', { name: /^À traiter/ });
    const box = await title.boundingBox();
    if (box === null) {
      throw new Error('The drawer shows its title');
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, HALF_TOP + 20, { steps: 20 });
    await page.mouse.up();
    await expectDrawerTopAt(page, HALF_TOP);
  });

  test('raises the drawer to the row of a tapped marker, and opens the Sheet full width from the row', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await openToApplyOnPhone({ page, asCandidate, openPage });
    await expectDrawerTopAt(page, PEEK_TOP);

    await page
      .getByRole('region', { name: 'Carte des Offres' })
      .getByRole('button', { name: /^Tours · / })
      .click();

    await expectDrawerTopAt(page, HALF_TOP);
    await expect(findToursRow(page)).toBeInViewport();
    await expect(findToursRow(page)).toHaveAttribute('data-active', '');
    await expect(page).not.toHaveURL(/posting=/);

    await findToursRow(page)
      .getByRole('button', { name: 'Aperçu de cette Offre' })
      .click({ position: { x: 8, y: 8 } });
    const sheet = page.getByRole('dialog', { name: /^greffier-max-tours/ });
    await expect(sheet).toBeVisible();
    await expect.poll(() => widthOf(sheet)).toBe(PHONE.width);
    await expect.poll(() => findOverflowing(page)).toEqual([]);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`fits a phone screen in the ${colorScheme} theme`, async ({ page, asCandidate, openPage }) => {
      await page.emulateMedia({ colorScheme });
      await openToApplyOnPhone({ page, asCandidate, openPage });

      await expect(page.locator('html')).toHaveClass(colorScheme === 'dark' ? /dark/ : /^(?!.*dark)/);
      await expect(findDrawer(page)).toBeVisible();
      await expect.poll(() => findOverflowing(page)).toEqual([]);
      await findDrawer(page).getByRole('button', { name: 'Agrandir la liste' }).click();
      await findDrawer(page).getByRole('button', { name: 'Agrandir la liste' }).click();
      await expectDrawerTopAt(page, HEADER_HEIGHT);
      await expect.poll(() => findOverflowing(page)).toEqual([]);
    });
  }
});
