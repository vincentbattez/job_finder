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

// The Postings of the Candidate asCandidate chose
async function openPostingsOf({ page, openPage }: IFront, candidateName: string) {
  await openPage('/postings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Offres de ${candidateName}`);
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

test('shows the last Detection on landing, then a Detection of no new Posting as a titled block', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('lou');
  await openPostingsOf({ page, openPage }, 'Lou');
  await expect(page.getByText('Dernière Détection')).toBeVisible();

  await page.getByRole('button', { name: 'Lancer une Détection' }).click();

  const result = page.getByRole('region', { name: 'Aucune nouvelle Offre' });
  await expect(result).toBeVisible({ timeout: VERDICT_TIMEOUT_MS });
  await expect(page.getByRole('status')).toHaveText('Aucune nouvelle Offre');
  await expect(result).toContainText('lancée depuis le bouton');
  await expect(result).toContainText('Greffier placé : la Source a listé 81 Offres, toutes déjà connues.');
  await expect(result.locator('time')).toHaveAttribute('datetime', /^\d{4}-/);
  // The near-miss Postings, collapsed
  const nearMiss = result.getByText('1 titre écarté de peu');
  await expect(nearMiss).toBeVisible();
  await expect(result.getByText('lou-near')).toBeHidden();
  await nearMiss.click();
  await expect(result.getByText('lou-near')).toBeVisible();
  // The Watch goes by its label, never by its identifier
  await expect(page.locator('main')).not.toContainText('lou-1');
});

test('shows the progress of a first launch, after a reload too, then what it imported in one screen', async ({
  page,
  asCandidate,
  openPage,
}) => {
  restartFirstLaunch('iris-1');
  await asCandidate('iris');
  await openPostingsOf({ page, openPage }, 'Iris');

  await page.getByRole('button', { name: 'Lancer une Détection' }).click();

  const progress = page.getByRole('region', { name: 'Détection en cours' });
  await expect(progress).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(/^Détection en cours : /);
  await expect(progress).toContainText('Greffier placé');
  await expect(progress).toContainText(/Lecture des Fiches de poste \d+ \/ 81/, { timeout: VERDICT_TIMEOUT_MS });
  await expect(progress).toContainText(/min \d+ s écoulées/);
  await expect(progress.getByRole('progressbar')).toHaveAttribute('max', '81');
  // The panel survives a reload, and no second Detection can start
  await page.reload();
  await expect(progress).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lancer une Détection' })).toBeHidden();

  const result = page.getByRole('region', { name: '81 Offres importées' });
  await expect(result).toBeVisible({ timeout: VERDICT_TIMEOUT_MS });
  await expect(result).toContainText(
    'Greffier placé : premier lancement, 81 Offres importées, sans Recherche ni notification.',
  );
  const viewportHeight = page.viewportSize()?.height ?? 0;
  const resultBox = await result.boundingBox();
  expect(resultBox?.height ?? Infinity).toBeLessThanOrEqual(viewportHeight);
});

test('names the first new Postings and marks them all New in the list', async ({ page, asCandidate, openPage }) => {
  await asCandidate('jules');
  await openPostingsOf({ page, openPage }, 'Jules');

  await page.getByRole('button', { name: 'Lancer une Détection' }).click();

  const result = page.getByRole('region', { name: '81 nouvelles Offres' });
  await expect(result).toBeVisible({ timeout: VERDICT_TIMEOUT_MS });
  await expect(page.getByRole('status')).toHaveText('81 nouvelles Offres');
  await expect(result.getByRole('link', { name: /^Greffier placé \d+$/ })).toHaveCount(3);
  await expect(result.getByRole('link', { name: 'Les voir dans la liste, marquées « Nouvelle »' })).toHaveAttribute(
    'href',
    '/#posting-list',
  );
  await expect(page.locator('#posting-list').getByText('Nouvelle', { exact: true })).toHaveCount(81);
});

test('tells a failure, what was done before it, and offers to run it again', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('theo');
  await openPostingsOf({ page, openPage }, 'Théo');
  // Left over by an earlier run: the button runs it again
  await page.getByRole('button', { name: /Lancer une Détection|La relancer/ }).click();

  const result = page.getByRole('region', { name: 'La Détection a échoué' });
  await expect(result).toBeVisible({ timeout: VERDICT_TIMEOUT_MS });
  await expect(page.getByRole('status')).toHaveText('La Détection a échoué');
  await expect(result).toContainText('The slow Source failed on');
  await expect(result).toContainText(
    'Greffier placé : arrêtée à « Lecture des Fiches de poste », Fiches de poste lues : 2. 2 nouvelles Offres enregistrées avant.',
  );
  await expect(page.getByRole('button', { name: 'La relancer' })).toBeVisible();
});

test('shows a Detection of another Candidate running, without letting a second one start', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('iris');
  await openPostingsOf({ page, openPage }, 'Iris');
  await page.getByRole('button', { name: 'Lancer une Détection' }).click();
  await expect(page.getByRole('region', { name: 'Détection en cours' })).toBeVisible();

  await asCandidate('lou');

  await openPostingsOf({ page, openPage }, 'Lou');

  const progress = page.getByRole('region', { name: 'Détection en cours' });
  await expect(progress).toContainText('Une Détection cherche dans les Veilles d’un autre Candidat');
  await expect(page.getByRole('button', { name: 'Lancer une Détection' })).toBeHidden();
  // Over, its verdict is Iris's: Lou's stays as it was
  await expect(page.getByRole('button', { name: 'Lancer une Détection' })).toBeVisible({
    timeout: VERDICT_TIMEOUT_MS,
  });
});
