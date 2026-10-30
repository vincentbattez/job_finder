import { expect, test } from '@playwright/test';

// These parcours change data, each on its own Posting that test/seed-front.ts prepared: Bastia has a
// Recherche and a Lettre, Versailles two Recherches. The read tests keep Béthune 2026-2445600.
const BASTIA_REFERENCE = '2026-2426147';
const VERSAILLES_REFERENCE = '2026-2409178';

const CORRECTED_LETTRE = 'Madame la Première présidente,\n\nTitulaire d’un master 2 de droit privé obtenu en 2025.\n';

test('corrects a Lettre, saves it, marks the Posting as Applied and finds the Lettre frozen', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/postings/${BASTIA_REFERENCE}`);
  const lettre = page.getByRole('region', { name: 'Lettre' });
  const brouillon = lettre.getByRole('figure', { name: 'brouillon.md' });
  const correction = lettre.getByRole('figure', { name: 'lettre.md' });
  // The Brouillon reads as the AI wrote it; the Lettre, its copy, opens in the editor
  await expect(brouillon.getByRole('textbox')).toHaveCount(0);
  await expect(brouillon.locator('mark')).toHaveText(['[à compléter : diplôme et année d’obtention]']);
  await expect(correction.locator('mark')).toHaveText(['[à compléter : diplôme et année d’obtention]']);

  await correction.getByRole('textbox', { name: 'Markdown' }).fill(CORRECTED_LETTRE);
  await expect(correction.getByText('Modifications non enregistrées')).toBeVisible();
  await expect(correction.locator('mark')).toHaveCount(0);
  await correction.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(correction.getByText('Modifications non enregistrées')).toBeHidden();
  await page.reload();
  await expect(correction.getByRole('textbox', { name: 'Markdown' })).toHaveValue(CORRECTED_LETTRE);
  await expect(brouillon).toContainText('[à compléter : diplôme et année d’obtention]');
  await expect(async () => {
    await correction.getByRole('button', { name: 'Copier le Markdown' }).click();
    expect(await page.evaluate(() => globalThis.navigator.clipboard.readText())).toBe(CORRECTED_LETTRE);
  }).toPass();

  // Applied is never undone: a second click confirms it
  await page.getByRole('button', { name: 'Marquer comme Postulée' }).click();
  await expect(page.getByText('Postulée', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmer : Postulée' }).click();

  await expect(page.getByText('Postulée', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marquer comme Postulée' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archiver' })).toBeVisible();
  await expect(lettre.getByRole('textbox')).toHaveCount(0);
  await expect(correction).toContainText('Titulaire d’un master 2 de droit privé obtenu en 2025.');
});

test('changes the Version retenue of an Artefact', async ({ page }) => {
  await page.goto(`/postings/${VERSAILLES_REFERENCE}`);
  const recherche = page.getByRole('region', { name: 'Recherche' });
  await expect(recherche.locator('li > details > summary')).toHaveText([
    /^v1\s*Prêt\s*Consignes par défaut\s*\d/,
    /^v2\s*Prêt\s*Retenue/,
  ]);
  await expect(recherche.getByRole('textbox', { name: 'Markdown' })).toHaveValue(/^# Recherche relancée/);

  await recherche.locator('li > details > summary', { hasText: 'v1' }).click();
  await recherche.getByRole('button', { name: 'Retenir cette Version' }).click();

  await expect(recherche.locator('li > details > summary')).toHaveText([
    /^v1\s*Prêt\s*Retenue/,
    /^v2\s*Prêt\s*Consignes par défaut\s*\d/,
  ]);
  // The editor follows the Version retenue
  await expect(recherche.getByRole('textbox', { name: 'Markdown' })).toHaveValue(/^# Recherche première/);
});
