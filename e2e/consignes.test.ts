import { expect, test, type Page } from '@playwright/test';

// Sacha's Consignes are the ones these tests change; test/seed-front.ts leaves them to the default
// ones. Léa's Offre 2026-2409247 has a Recherche made with the default Consignes, then one with hers.
async function openConsignesOfSacha(page: Page) {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Sacha');
  await page.getByRole('button', { name: 'Choisir' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Sacha');
  await page.getByRole('link', { name: 'Consignes', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Consignes de Sacha');
}

test.describe('Consignes of a Candidat', () => {
  test('shows the default Consignes of each module, and never the fixed part as editable', async ({ page }) => {
    await openConsignesOfSacha(page);

    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Recherche',
      'Lettre',
      'Fiche d’entretien',
      'Visualisation',
    ]);
    const lettre = page.getByRole('region', { name: 'Lettre' });
    await expect(lettre.getByText('Consignes par défaut', { exact: true })).toBeVisible();
    await expect(lettre.getByRole('textbox')).toHaveValue(/^Écris une lettre de motivation d'une page/);
    // The fixed part of every prompt holds this rule: no field of the page carries it
    const textboxList = await page.getByRole('textbox').all();
    expect(textboxList).toHaveLength(4);
    for (const textbox of textboxList) {
      await expect(textbox).not.toHaveValue(/N'invente jamais un fait/);
    }
  });

  test('creates the Candidat’s own Consignes, modifies them, then deletes them for the default ones', async ({
    page,
  }) => {
    await openConsignesOfSacha(page);
    const lettre = page.getByRole('region', { name: 'Lettre' });

    await lettre.getByRole('textbox').fill('Une lettre courte, au ton direct.\n');
    await expect(lettre.getByText('Modifications non enregistrées')).toBeVisible();
    await lettre.getByRole('button', { name: 'Enregistrer mes Consignes' }).click();
    await expect(lettre.getByText('Vos Consignes', { exact: true })).toBeVisible();
    await lettre.getByRole('textbox').fill('Une lettre très courte.\n');
    await lettre.getByRole('button', { name: 'Enregistrer mes Consignes' }).click();
    await expect(lettre.getByText('Modifications non enregistrées')).toBeHidden();
    await page.reload();
    await expect(lettre.getByRole('textbox')).toHaveValue('Une lettre très courte.\n');
    await expect(
      page.getByRole('region', { name: 'Recherche' }).getByText('Consignes par défaut', { exact: true }),
    ).toBeVisible();

    await lettre.getByRole('button', { name: 'Revenir aux Consignes par défaut' }).click();

    await expect(lettre.getByText('Consignes par défaut', { exact: true })).toBeVisible();
    await expect(lettre.getByRole('textbox')).toHaveValue(/^Écris une lettre de motivation d'une page/);
  });

  test('tells which Consignes produced each Version', async ({ page }) => {
    await page.goto('/offres/2026-2409247');

    const recherche = page.getByRole('region', { name: 'Recherche' });
    await expect(recherche.locator('summary')).toHaveText([/^v1.*Consignes par défaut/, /^v2.*Consignes du Candidat/]);
  });
});
