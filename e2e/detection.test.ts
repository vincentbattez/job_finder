import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { z } from 'zod/v4';

import { expect, test, type IFront } from './candidate.ts';

// A single Detection runs at a time, whoever starts it (ADR-0014): these tests run one after the other,
// each on Candidates of its own, which no other test file detects. They follow the slow fake Source
// (test/fake-slow-source.ts), which lists 81 Postings and a near-miss one: Lou's, always the same and
// already detected by test/seed-front.ts; Jules', new at each search; Iris's, on its first launch;
// Théo's, failing after two Job Descriptions.
test.describe.configure({ mode: 'serial' });

// The slow Source searches for 1.5 s, then reads 81 Job Descriptions; the page reads it every 2 s
const VERDICT_TIMEOUT_MS = 30_000;
// How long a raw write of these tests waits for the server's own writes to release the database
const BUSY_TIMEOUT_MS = 5000;
const START_NAME = 'Lancer une Détection';
const RUNNING_NAME = 'Détection en cours';

// New, where a Candidate starts and follows a Detection, with the button ready to take a click
async function openNew({ page, openPage }: Pick<IFront, 'page' | 'openPage'>) {
  await openPage('/');
  await expect(page.getByRole('button', { name: START_NAME })).toBeEnabled({ timeout: VERDICT_TIMEOUT_MS });
}

// Its Watch on its first launch again, as a new one: a rerun of the test starts from there. Through the
// database, as the Profile form resets it only when the Parameters change.
function restartFirstLaunch(watchId: string) {
  const { dataDirectory } = z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata);
  // The dev server and the worker write to this database too, and the previous test's Detection may
  // still be committing: without a busy timeout, SQLite answers "database is locked" at once
  const database = new DatabaseSync(path.join(dataDirectory, 'job_finder.sqlite'), { timeout: BUSY_TIMEOUT_MS });
  database.prepare('UPDATE "Watch" SET "detectedAt" = NULL WHERE "id" = ?').run(watchId);
  database.close();
}

test('starts from the header, then tells a Detection of no new Posting, its Near Misses linked, until closed', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('lou');
  await openNew({ page, openPage });

  await page.getByRole('button', { name: START_NAME }).click();

  await expect(page.getByRole('region', { name: 'Notifications alt+T' })).toContainText('Détection lancée');
  const verdict = page.getByRole('region', { name: 'Aucune nouvelle Offre' });
  await expect(verdict).toBeVisible({ timeout: VERDICT_TIMEOUT_MS });
  await expect(page.locator('main').getByRole('status')).toHaveText('Aucune nouvelle Offre');
  await expect(verdict).toContainText('lancée depuis le bouton');
  await expect(verdict).toContainText('Greffier placé : la Source a listé 81 Offres, toutes déjà connues.');
  await expect(verdict.locator('time')).toHaveAttribute('datetime', /^\d{4}-/);
  await expect(verdict.getByRole('link', { name: '1 titre écarté de peu' })).toHaveAttribute(
    'href',
    '/watches#near-misses',
  );
  // The Watch goes by its label, never by its identifier
  await expect(page.locator('main')).not.toContainText('lou-1');

  await verdict.getByRole('button', { name: 'Fermer la Détection' }).click();
  await expect(verdict).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: START_NAME })).toBeEnabled();
  await expect(verdict).toBeHidden();
});

test('shows the progress of each Watch, after a reload too, the button held, then what a first launch imported', async ({
  page,
  asCandidate,
  openPage,
}) => {
  restartFirstLaunch('iris-1');
  await asCandidate('iris');
  await openNew({ page, openPage });

  await page.getByRole('button', { name: START_NAME }).click();

  const progress = page.getByRole('region', { name: RUNNING_NAME });
  await expect(progress).toBeVisible();
  await expect(page.locator('main').getByRole('status')).toHaveText(/^Détection en cours : /);
  await expect(progress).toContainText('Greffier placé');
  await expect(progress).toContainText(/Lecture des Fiches de poste \d+ \/ 81/, { timeout: VERDICT_TIMEOUT_MS });
  await expect(progress).toContainText(/Lancée à \d{2}:\d{2} · \d+ min \d+ s écoulées/);
  await expect(progress.getByRole('progressbar')).toBeVisible();
  // The Card survives a reload, and no second Detection can start
  await page.reload();
  await expect(progress).toBeVisible();
  await expect(page.getByRole('button', { name: RUNNING_NAME })).toBeDisabled();

  const verdict = page.getByRole('region', { name: '81 Offres importées' });
  await expect(verdict).toBeVisible({ timeout: VERDICT_TIMEOUT_MS });
  await expect(verdict).toContainText(
    'Greffier placé : premier lancement, 81 Offres importées, sans Recherche ni notification.',
  );
  await expect(page.getByRole('button', { name: START_NAME })).toBeEnabled();
});

test('fills the found group at the top of New while it reads, then tells how many', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('jules');
  await openNew({ page, openPage });

  await page.getByRole('button', { name: START_NAME }).click();

  await expect(page.getByRole('region', { name: RUNNING_NAME })).toBeVisible();
  // Polled, before the verdict: the Card is still there
  const foundGroup = page.getByRole('heading', { level: 2, name: /^Trouvées à l’instant/ });
  await expect(foundGroup).toBeVisible({ timeout: VERDICT_TIMEOUT_MS });
  await expect(page.getByRole('region', { name: RUNNING_NAME })).toBeVisible();

  const verdict = page.getByRole('region', { name: '81 nouvelles Offres' });
  await expect(verdict).toBeVisible({ timeout: VERDICT_TIMEOUT_MS });
  await expect(page.locator('main').getByRole('status')).toHaveText('81 nouvelles Offres');
  await expect(verdict).toContainText('Greffier placé : 81 nouvelles Offres.');
  await expect(foundGroup).toBeVisible();
});

test('tells a failure and what was done before it, the button ready to run it again', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('theo');
  await openNew({ page, openPage });

  await page.getByRole('button', { name: START_NAME }).click();

  const verdict = page.getByRole('region', { name: 'La Détection a échoué' });
  await expect(verdict).toBeVisible({ timeout: VERDICT_TIMEOUT_MS });
  await expect(page.locator('main').getByRole('status')).toHaveText('La Détection a échoué');
  await expect(verdict).toContainText('The slow Source failed on');
  await expect(verdict).toContainText(
    'Greffier placé : arrêtée à « Lecture des Fiches de poste », Fiches de poste lues : 2. 2 nouvelles Offres enregistrées avant.',
  );
  await expect(page.getByRole('button', { name: START_NAME })).toBeEnabled();
});

test('refuses a Detection while one runs, a page left open telling when that one started', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('lou');
  await openNew({ page, openPage });
  // Started elsewhere: this idle page does not poll, so its button still offers to start one
  const started = await page.request.post('/detect');
  expect(started.ok()).toBe(true);

  await page.getByRole('button', { name: START_NAME }).click();

  await expect(page.getByRole('region', { name: 'Notifications alt+T' })).toContainText(
    /Une Détection est déjà en cours, lancée le /,
  );
  await expect(page.getByRole('region', { name: RUNNING_NAME })).toBeVisible();
  await expect(page.getByRole('button', { name: START_NAME })).toBeEnabled({ timeout: VERDICT_TIMEOUT_MS });
});

test('shows a Detection of another Candidate running, without letting a second one start', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('iris');
  await openNew({ page, openPage });
  await page.getByRole('button', { name: START_NAME }).click();
  await expect(page.getByRole('region', { name: RUNNING_NAME })).toBeVisible();

  await asCandidate('lou');
  await openPage('/');

  const progress = page.getByRole('region', { name: RUNNING_NAME });
  await expect(progress).toContainText('Une Détection cherche dans les Veilles d’un autre Candidat');
  await expect(page.getByRole('button', { name: RUNNING_NAME })).toBeDisabled();
  // Over, its verdict is Iris's: Lou's stays as it was
  await expect(page.getByRole('button', { name: START_NAME })).toBeEnabled({ timeout: VERDICT_TIMEOUT_MS });
});
