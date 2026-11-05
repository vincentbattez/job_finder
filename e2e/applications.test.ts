import type { Locator, Page } from '@playwright/test';
import { z } from 'zod/v4';

import { expect, test, type IFront } from './candidate.ts';
import { openDatabase } from './harness.ts';
import { findOverflowing } from './overflow.ts';

const DAY_MS = 86_400_000;

// Léa's Archived Application (test/seed-front.ts)
const ARCHIVED_REFERENCE = '2026-2340735';

// Rosa's eight imported Postings (test/seed-front.ts), in the order the seed imported them, as this file
// sets them: Interviews, Deadline and the day Applied counted in days from now
const POSTING_LIST = [
  { city: 'Lille', status: 'applied', interviewDayList: [-10, -2], deadlineDays: null, appliedDays: -30 },
  { city: 'Lyon', status: 'applied', interviewDayList: [-5], deadlineDays: null, appliedDays: -25 },
  { city: 'Bordeaux', status: 'applied', interviewDayList: [3], deadlineDays: null, appliedDays: -20 },
  { city: 'Rennes', status: 'applied', interviewDayList: [-4, 1], deadlineDays: null, appliedDays: -15 },
  { city: 'Nice', status: 'applied', interviewDayList: [], deadlineDays: 20, appliedDays: -3 },
  { city: 'Strasbourg', status: 'applied', interviewDayList: [], deadlineDays: 5, appliedDays: -2 },
  { city: 'Dijon', status: 'hired', interviewDayList: [-40], deadlineDays: null, appliedDays: -60 },
  { city: 'Brest', status: 'rejected', interviewDayList: [], deadlineDays: null, appliedDays: -50 },
];

// A time from now as Prisma stores a DateTime
function fromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().replace('Z', '+00:00');
}

// Rosa's Postings as this file needs them, whatever a previous run left. Their title, which names their
// folder, stays the seed's: their employer tells them apart
function resetRosa() {
  const database = openDatabase();
  const postingList = z
    .array(z.object({ id: z.number(), reference: z.string() }))
    .parse(
      database.prepare('SELECT "id", "reference" FROM "Posting" WHERE "candidateId" = ? ORDER BY "id"').all('rosa'),
    );
  const update = database.prepare(
    `UPDATE "Posting" SET "employer" = ?, "city" = ?, "region" = NULL, "latitude" = ?, "longitude" = ?,
      "deadline" = ?, "status" = ?, "appliedAt" = ?, "archivedAt" = NULL WHERE "id" = ?`,
  );
  const interviewDeletion = database.prepare('DELETE FROM "Interview" WHERE "postingId" = ?');
  const insertInterview = database.prepare(
    `INSERT INTO "Interview" ("postingId", "number", "startAt", "durationMinutes", "place", "interviewers")
      VALUES (?, ?, ?, 60, 'Tribunal', 'Mme Durand')`,
  );
  // At once: another test of this file may be reading Rosa's Applications meanwhile
  database.exec('BEGIN IMMEDIATE');
  for (const [index, { city, status, interviewDayList, deadlineDays, appliedDays }] of POSTING_LIST.entries()) {
    const { id } = z.object({ id: z.number() }).parse(postingList[index]);
    update.run(
      `Cour d’appel de ${city}`,
      city,
      45 + index,
      index - 1,
      deadlineDays === null ? null : fromNow(deadlineDays),
      status,
      fromNow(appliedDays),
      id,
    );
    interviewDeletion.run(id);
    for (const [number, days] of interviewDayList.entries()) {
      insertInterview.run(id, number + 1, fromNow(days));
    }
  }
  database.exec('COMMIT');
  database.close();
}

async function openApplicationsOfRosa({
  page,
  asCandidate,
  openPage,
}: IFront & { asCandidate: (id: string) => Promise<void> }) {
  // The tiles come from OpenStreetMap over the internet: the markers show without them
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  resetRosa();
  await asCandidate('rosa');
  await openPage('/applications');
}

function findPanel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Candidatures' });
}

function findMarker(page: Page, city: string): Locator {
  return page
    .getByRole('region', { name: 'Carte des Offres' })
    .getByRole('button', { name: new RegExp(`^${city} · `) });
}

function findRow(page: Page, city: string): Locator {
  return page.getByRole('listitem').filter({ hasText: `Cour d’appel de ${city}` });
}

test.describe('Applications on the map', () => {
  test('groups In progress as Interviewed, Invited then Applied, each group in its order', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await openApplicationsOfRosa({ page, asCandidate, openPage });

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Candidatures');
    const panel = findPanel(page);
    await expect(panel.getByRole('tab')).toHaveText(['En cours6', 'Poste obtenu1', 'Refusées1']);
    await expect(panel.getByRole('tab', { name: /^En cours/ })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText([/^Entretien passé/, /^Convoquée/, /^Postulée/]);
    // The latest Interview first, then the soonest Interview, then the nearest Deadline; the City first
    await expect(panel.getByRole('region', { name: 'Entretien passé' }).getByRole('listitem')).toHaveText([
      /^Lille/,
      /^Lyon/,
    ]);
    await expect(panel.getByRole('region', { name: 'Convoquée' }).getByRole('listitem')).toHaveText([
      /^Rennes/,
      /^Bordeaux/,
    ]);
    await expect(panel.getByRole('region', { name: 'Postulée' }).getByRole('listitem')).toHaveText([
      /^Strasbourg/,
      /^Nice/,
    ]);
    // A row tells its Step, its next Interview and the day Applied
    const rennes = findRow(page, 'Rennes');
    await expect(rennes.locator('[data-step]')).toHaveText('Convoquée');
    await expect(rennes).toContainText('Entretien le');
    await expect(rennes).toContainText('Postulée le');
    await expect(findRow(page, 'Lille')).not.toContainText('Entretien le');

    // One color per Step on the markers, which the legend names
    await expect(findMarker(page, 'Rennes')).toHaveAttribute('data-group', 'invited');
    await expect(findMarker(page, 'Lille')).toHaveAttribute('data-group', 'interviewed');
    await expect(page.getByRole('list', { name: 'Légende' }).getByRole('listitem')).toHaveText([
      'Entretien passé',
      'Convoquée',
      'Postulée',
    ]);
  });

  test('shows Hired and Rejected in their own tabs, which the URL keeps', async ({ page, asCandidate, openPage }) => {
    await openApplicationsOfRosa({ page, asCandidate, openPage });
    const panel = findPanel(page);

    await panel.getByRole('tab', { name: /^Poste obtenu/ }).click();
    await expect(page).toHaveURL('/applications?tab=hired');
    await expect(panel.getByRole('listitem')).toHaveText([/^Dijon/]);
    await expect(findRow(page, 'Dijon').locator('[data-step]')).toHaveText('Poste obtenu');

    await panel.getByRole('tab', { name: /^Refusées/ }).click();
    await expect(page).toHaveURL('/applications?tab=rejected');
    await expect(panel.getByRole('listitem')).toHaveText([/^Brest/]);

    // Back returns to the previous tab
    await page.goBack();
    await expect(page).toHaveURL('/applications?tab=hired');
    await expect(panel.getByRole('tab', { name: /^Poste obtenu/ })).toHaveAttribute('aria-selected', 'true');

    await openPage('/applications?tab=rejected');
    await expect(findPanel(page).getByRole('listitem')).toHaveText([/^Brest/]);
  });

  test('is reached from the Sidebar', async ({ page, asCandidate, openPage }) => {
    await asCandidate('lea');
    await openPage('/');

    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Candidatures' }).click();
    await expect(page).toHaveURL('/applications');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Candidatures');
  });

  test('shows an Archived Application at its step on its page, beside the Archived mark', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await asCandidate('lea');
    await openPage(`/postings/${ARCHIVED_REFERENCE}`);

    await expect(page.locator('main > header [data-step]')).toHaveText('Postulée · archivée');
  });

  test('fits a phone screen', async ({ page, asCandidate, openPage }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApplicationsOfRosa({ page, asCandidate, openPage });

    // On a phone the list is a drawer over the map (e2e/phone.test.ts)
    await expect(page.getByRole('dialog', { name: /^Candidatures/ }).getByRole('tab')).toHaveCount(3);
    await expect.poll(() => findOverflowing(page)).toEqual([]);
  });

  test('asks who is there before showing any Application', async ({ page }) => {
    await page.goto('/applications');

    await expect(page.getByText('Qui consulte ses Offres ?')).toBeVisible();
    await expect(findPanel(page)).toHaveCount(0);
  });
});
