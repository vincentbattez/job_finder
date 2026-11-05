import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import { expect, type Locator, type Page } from '@playwright/test';
import { z } from 'zod/v4';

import { findDataDirectory, openDatabase, READY_TIMEOUT_MS } from './harness.ts';

export function findInterviews(page: Page): Locator {
  return page.getByRole('region', { name: 'Entretiens' });
}

// A detected Posting of the seed is New: put To Apply as keeping it would, without the Research keeping
// queues, which these tests produce themselves or go without (ADR-0018)
function putToApply(reference: string): void {
  const database = openDatabase();
  database
    .prepare(`UPDATE "Posting" SET "status" = 'to_apply' WHERE "reference" = ? AND "status" = 'new'`)
    .run(reference);
  database.close();
}

function listInterviewNumbers(reference: string): number[] {
  const database = openDatabase();
  const rowList = database
    .prepare(
      `SELECT "Interview"."number" AS "number" FROM "Interview"
       JOIN "Posting" ON "Posting"."id" = "Interview"."postingId" WHERE "Posting"."reference" = ?`,
    )
    .all(reference);
  database.close();
  return z
    .array(z.object({ number: z.number() }))
    .parse(rowList)
    .map(({ number }) => number);
}

// Each test starts from an Application without any Interview, whatever a previous run left: deleted
// through the route, which deletes their Artifacts, files included
async function deleteEveryInterview(page: Page, reference: string): Promise<void> {
  for (const number of listInterviewNumbers(reference)) {
    const response = await page.request.post(`/postings/${reference}/interviews`, {
      form: { intent: 'delete', number: String(number) },
    });
    expect(response.ok()).toBe(true);
  }
}

// The Posting Applied, as the header would without the dialog a Letter not validated opens, and without
// any Interview
export async function prepareApplication(page: Page, reference: string): Promise<void> {
  putToApply(reference);
  const response = await page.request.post(`/postings/${reference}/status`, { form: { status: 'applied' } });
  expect(response.ok()).toBe(true);
  await deleteEveryInterview(page, reference);
}

// The folders of the Versions past the first ones
function readVersionFolders(research: string, keptCount: number): string[] {
  return readdirSync(research)
    .filter((name) => Number(name.slice(1)) > keptCount)
    .map((name) => path.join(research, name));
}

// A test that produces the Research of its Posting starts without one, whatever a previous run left:
// its Versions, and their folders, which a new Version 1 could not take over. A seed's failed Version
// stays, when told how many to keep.
export function forgetResearch(reference: string, keptCount = 0): void {
  const database = openDatabase();
  const row = database.prepare('SELECT "id", "candidateId" FROM "Posting" WHERE "reference" = ?').get(reference);
  const { id, candidateId } = z.object({ id: z.number(), candidateId: z.string() }).parse(row);
  database
    .prepare(`DELETE FROM "Version" WHERE "artifact" = 'research' AND "postingId" = ? AND "number" > ?`)
    .run(id, keptCount);
  // Their jobs too: the state of an Artifact is that of its last job
  database
    .prepare(
      `DELETE FROM "Job" WHERE "module" = 'research' AND "postingId" = ? AND "id" NOT IN
       (SELECT "jobId" FROM "Version" WHERE "postingId" = ? AND "jobId" IS NOT NULL)`,
    )
    .run(id, id);
  database.close();
  const postingsDirectory = path.join(findDataDirectory(), 'candidates', candidateId, 'postings');
  for (const folder of readdirSync(postingsDirectory)) {
    if (!folder.startsWith(reference)) {
      continue;
    }
    const research = path.join(postingsDirectory, folder, 'research');
    const forgottenList = keptCount === 0 ? [research] : readVersionFolders(research, keptCount);
    for (const version of forgottenList) {
      rmSync(version, { recursive: true, force: true });
    }
  }
}

function countReadyVersions(reference: string, artifact: string): number {
  const database = openDatabase();
  const row = database
    .prepare(
      `SELECT count(*) AS "count" FROM "Version" JOIN "Posting" ON "Posting"."id" = "Version"."postingId"
       WHERE "Posting"."reference" = ? AND "Version"."artifact" = ? AND "Version"."state" = 'ready'`,
    )
    .get(reference, artifact);
  database.close();
  return z.object({ count: z.number() }).parse(row).count;
}

// A Version run by the worker, a Draft until validated, once the Posting has that many ready
export async function runVersion(
  page: Page,
  { readyCount, ...form }: Readonly<{ module: string; reference: string; interview?: string; readyCount: number }>,
): Promise<void> {
  const response = await page.request.post('/run', { form });
  expect(response.ok()).toBe(true);
  await expect
    .poll(() => countReadyVersions(form.reference, form.module), { timeout: READY_TIMEOUT_MS, intervals: [100] })
    .toBe(readyCount);
}

// The Posting page open on a single Interview, freshly added: what a Portrait and an Interview Brief
// prepare
export async function prepareInterview(page: Page, reference: string): Promise<void> {
  await prepareApplication(page, reference);
  const response = await page.request.post(`/postings/${reference}/interviews`, {
    form: {
      intent: 'add',
      start: '2099-11-19T14:00',
      durationMinutes: '60',
      place: '',
      interviewers: 'Mme Durand, juge des enfants',
    },
  });
  expect(response.ok()).toBe(true);
  await page.goto(`/postings/${reference}?tab=interviews&interview=1`);
  // A click before React runs the page would go nowhere: wait for it
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}
