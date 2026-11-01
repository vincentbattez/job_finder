import { expect, test, type Page } from '@playwright/test';

import { unfoldChosenVersion } from './version.ts';

// These journeys change data, each on its own Posting that test/seed-front.ts prepared: Bastia has a
// Research and a Letter, Versailles two Research. The read tests keep Béthune 2026-2445600.
const BASTIA_REFERENCE = '2026-2426147';
const VERSAILLES_REFERENCE = '2026-2409178';
// Applications the seed marks Applied, whose outcome these tests change: one with JS, one without
const OUTCOME_REFERENCE = '2026-2448056';
const OUTCOME_WITHOUT_JS_REFERENCE = '2026-2448209';

const CORRECTED_LETTER = 'Madame la Première présidente,\n\nTitulaire d’un master 2 de droit privé obtenu en 2025.\n';

test('corrects a Letter, saves it, marks the Posting as Applied, finds the Letter frozen, then undoes it', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Back To Apply, whatever a run stopped halfway left it at
  const response = await page.request.post(`/postings/${BASTIA_REFERENCE}/status`, { form: { status: 'to_apply' } });
  expect(response.ok()).toBe(true);
  await page.goto(`/postings/${BASTIA_REFERENCE}`);
  const letter = page.getByRole('region', { name: 'Lettre' });
  const draft = letter.getByRole('figure', { name: 'draft.md' });
  const correction = letter.getByRole('figure', { name: 'letter.md' });
  await unfoldChosenVersion(letter);
  // The Draft reads as the AI wrote it; the Letter, its copy, opens in the editor
  await expect(draft.getByRole('textbox')).toHaveCount(0);
  await expect(draft.locator('mark')).toHaveText(['[à compléter : diplôme et année d’obtention]']);
  await expect(correction.locator('mark')).toHaveText(['[à compléter : diplôme et année d’obtention]']);

  await correction.getByRole('textbox', { name: 'Markdown' }).fill(CORRECTED_LETTER);
  await expect(correction.getByText('Modifications non enregistrées')).toBeVisible();
  await expect(correction.locator('mark')).toHaveCount(0);
  await correction.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(correction.getByText('Modifications non enregistrées')).toBeHidden();
  await page.reload();
  await unfoldChosenVersion(letter);
  await expect(correction.getByRole('textbox', { name: 'Markdown' })).toHaveValue(CORRECTED_LETTER);
  await expect(draft).toContainText('[à compléter : diplôme et année d’obtention]');
  await expect(async () => {
    await correction.getByRole('button', { name: 'Copier le Markdown' }).click();
    expect(await page.evaluate(() => globalThis.navigator.clipboard.readText())).toBe(CORRECTED_LETTER);
  }).toPass();

  // Applied freezes the Letter: a second click confirms it
  await page.getByRole('button', { name: 'Marquer comme Postulée' }).click();
  await expect(
    page.getByText('Une fois Postulée, la Lettre retenue ne change plus : c’est celle envoyée.'),
  ).toBeVisible();
  await expect(page.getByText('Postulée', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmer : Postulée' }).click();

  await expect(page.getByText('Postulée', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marquer comme Postulée' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archiver' })).toBeVisible();
  await expect(letter.getByRole('textbox', { includeHidden: true })).toHaveCount(0);
  await expect(correction).toContainText('Titulaire d’un master 2 de droit privé obtenu en 2025.');

  // A Letter written is not a Letter sent: the Candidate undoes Applied, and the Letter changes again
  await page.getByRole('button', { name: 'Pas encore envoyée' }).click();
  await page.getByRole('button', { name: 'Confirmer : À traiter' }).click();

  await expect(page.locator('.posting-detail__title .badge')).toHaveText('À traiter');
  await expect(page.getByRole('button', { name: 'Marquer comme Postulée' })).toBeVisible();
  await expect(correction.getByRole('textbox', { name: 'Markdown' })).toHaveValue(CORRECTED_LETTER);
});

test('changes the Chosen Version of an Artifact', async ({ page }) => {
  await page.goto(`/postings/${VERSAILLES_REFERENCE}`);
  const research = page.getByRole('region', { name: 'Recherche' });
  await expect(research.locator('li > details > summary')).toHaveText([
    /^v1\s*Prêt\s*Consignes par défaut\s*\d/,
    /^v2\s*Prêt\s*Retenue/,
  ]);
  await unfoldChosenVersion(research);
  await expect(research.getByRole('textbox', { name: 'Markdown' })).toHaveValue(/^# Recherche relancée/);

  await research.locator('li > details > summary', { hasText: 'v1' }).click();
  await research.getByRole('button', { name: 'Retenir cette Version' }).click();

  await expect(research.locator('li > details > summary')).toHaveText([
    /^v1\s*Prêt\s*Retenue/,
    /^v2\s*Prêt\s*Consignes par défaut\s*\d/,
  ]);
  // The editor follows the Chosen Version
  await expect(research.getByRole('textbox', { name: 'Markdown' })).toHaveValue(/^# Recherche première/);
});

// Puts the Application back In progress first, whatever a run stopped halfway left it at
async function changeOutcome(page: Page, reference: string) {
  const response = await page.request.post(`/postings/${reference}/status`, { form: { status: 'applied' } });
  expect(response.ok()).toBe(true);
  await page.goto(`/postings/${reference}`);
  return {
    statusBadge: page.locator('.posting-detail__title .badge'),
    outcome: page.getByRole('group', { name: 'Issue de la Candidature' }),
  };
}

test('marks an Application Hired, then Rejected, then puts it back In progress through its own button', async ({
  page,
}) => {
  const { statusBadge, outcome } = await changeOutcome(page, OUTCOME_REFERENCE);
  await expect(statusBadge).toHaveText('Postulée');
  // In progress is no outcome: the group only holds the two, none pressed, and nothing to put back
  await expect(outcome.getByRole('button')).toHaveText(['Poste obtenu', 'Refusée']);
  await expect(outcome.getByRole('button', { pressed: true })).toHaveCount(0);
  const backInProgress = page.getByRole('button', { name: 'Remettre en cours' });
  await expect(backInProgress).toHaveCount(0);

  await outcome.getByRole('button', { name: 'Poste obtenu' }).click();
  await expect(statusBadge).toHaveText('Poste obtenu');
  await outcome.getByRole('button', { name: 'Refusée' }).click();
  await expect(statusBadge).toHaveText('Refusée');
  await expect(outcome.getByRole('button', { name: 'Refusée' })).toHaveAttribute('aria-pressed', 'true');
  await backInProgress.click();

  await expect(statusBadge).toHaveText('Postulée');
  await expect(backInProgress).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Marquer comme Postulée' })).toHaveCount(0);
});

test.describe('outcome selector before React runs', () => {
  test.use({ javaScriptEnabled: false });

  test('marks an Application Hired through a plain form', async ({ page }) => {
    const { statusBadge, outcome } = await changeOutcome(page, OUTCOME_WITHOUT_JS_REFERENCE);

    await outcome.getByRole('button', { name: 'Poste obtenu' }).click();

    await expect(statusBadge).toHaveText('Poste obtenu');
  });
});
