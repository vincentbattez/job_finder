import { expect, test } from '@playwright/test';

// Each test launches modules on an Offre of its own, which test/seed-front.ts prepares: the data
// folder is shared by the whole run. The e2e worker runs the queued jobs with the fake Claude, whose
// sessions last a second (test/e2e-actions.server.ts).
const LETTRE_REFERENCE = '2026-2409178';
const FAILED_RECHERCHE_REFERENCE = '2026-2412591';

// The worker takes the job, then its session lasts a second, and the fiche reads the état again
// every two seconds
const READY_TIMEOUT_MS = 15_000;

test.describe('launching the modules of an Offre', () => {
  test('launches the Lettre, then shows it turn ready without a reload', async ({ page }) => {
    await page.goto(`/offres/${LETTRE_REFERENCE}`);
    const lettre = page.getByRole('region', { name: 'Lettre' });
    await expect(lettre.getByRole('status')).toHaveText('Absent');

    await lettre.getByRole('button', { name: 'Lancer la Lettre' }).click();

    await expect(lettre.getByRole('status')).toHaveText('En cours');
    await expect(lettre.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
    await expect(lettre.locator('summary')).toHaveText([/^v1\s*Prêt\s*Retenue/]);
    await expect(lettre.locator('figcaption')).toHaveText(['brouillon.md', 'lettre.md']);
    await expect(page.locator('.artefact-list [data-artefact="lettre"]')).toContainText('Prêt');
    // No module produces the Fiche d'entretien yet
    await expect(page.getByRole('region', { name: 'Fiche d’entretien' }).getByRole('button')).toHaveCount(0);
  });

  test('relaunches a failed Recherche, which lets the Lettre run', async ({ page }) => {
    await page.goto(`/offres/${FAILED_RECHERCHE_REFERENCE}`);
    const recherche = page.getByRole('region', { name: 'Recherche' });
    const lettre = page.getByRole('region', { name: 'Lettre' });
    await expect(recherche.getByRole('status')).toHaveText('En échec');
    await expect(lettre).toContainText(`L'Offre ${FAILED_RECHERCHE_REFERENCE} n'a pas de Recherche retenue`);
    await expect(lettre.getByRole('button', { name: 'Lancer la Lettre' })).toBeDisabled();

    await recherche.getByRole('button', { name: 'Relancer la Recherche' }).click();

    await expect(recherche.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
    await expect(recherche.locator('summary')).toHaveText([/^v1\s*En échec/, /^v2\s*Prêt\s*Retenue/]);
    await expect(lettre.getByRole('button', { name: 'Lancer la Lettre' })).toBeEnabled();
    await expect(lettre).not.toContainText("n'a pas de Recherche retenue");
  });
});

test('launches a Détection and shows its result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Léa');
  await page.getByRole('button', { name: 'Choisir' }).click();

  await page.getByRole('button', { name: 'Lancer une Détection' }).click();

  // test/seed-front.ts already ran a Détection on the same recorded responses
  await expect(page.getByRole('status')).toHaveText(
    'Veille attache-de-justice-hauts-de-france : aucune nouvelle Offre',
  );
  await expect(page.getByRole('row', { name: /2026-2445600/ })).toBeVisible();
});
