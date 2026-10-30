import { expect, test } from '@playwright/test';

// Any visitor of the front creates or renames a Candidat, and sets the Délai par défaut (ADR-0011)
test.describe('Candidats', () => {
  test('creates a Candidat, who joins the menu, then renames them', async ({ page }) => {
    // A Candidat of its own on each run, since none is ever deleted
    const suffix = `${String(Date.now())}-${String(test.info().repeatEachIndex)}`;
    const id = `ambre-${suffix}`;
    await page.goto('/');
    await page.getByRole('link', { name: 'Candidats', exact: true }).click();
    const creation = page.getByRole('region', { name: 'Nouveau Candidat' });

    await creation.getByRole('textbox', { name: 'Nom', exact: true }).fill(`Ambre ${suffix}`);
    await creation.getByRole('textbox', { name: /^Identifiant/ }).fill(id);
    await creation.getByRole('button', { name: 'Créer le Candidat' }).click();

    const menu = page.getByRole('combobox', { name: 'Candidat' });
    await expect(menu.getByRole('option', { name: `Ambre ${suffix}` })).toHaveCount(1);
    const renaming = page.getByRole('region', { name: 'Renommer un Candidat' });
    await renaming.getByRole('textbox', { name: `Nom de ${id}` }).fill(`Ambre Martin ${suffix}`);
    await renaming.getByRole('button', { name: `Renommer ${id}` }).click();
    await expect(renaming.getByRole('textbox', { name: `Nom de ${id}` })).toHaveValue(`Ambre Martin ${suffix}`);
    await menu.selectOption({ label: `Ambre Martin ${suffix}` });
    await page.getByRole('button', { name: 'Choisir' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Offres de Ambre Martin ${suffix}`);
  });

  test('refuses an identifier another Candidat has, in the words of the action', async ({ page }) => {
    await page.goto('/candidats');
    const creation = page.getByRole('region', { name: 'Nouveau Candidat' });

    await creation.getByRole('textbox', { name: 'Nom', exact: true }).fill('Léa bis');
    await creation.getByRole('textbox', { name: /^Identifiant/ }).fill('lea');
    await creation.getByRole('button', { name: 'Créer le Candidat' }).click();

    await expect(creation.getByRole('alert')).toHaveText("Un Candidat a déjà l'identifiant lea : en choisir un autre.");
  });

  // Saved as it was: the other tests read Expirée at the same time
  test('saves the Délai par défaut', async ({ page }) => {
    await page.goto('/candidats');
    const delay = page.getByRole('region', { name: 'Délai par défaut' });

    await delay.getByRole('spinbutton', { name: 'Délai par défaut, en mois' }).fill('6');
    await delay.getByRole('button', { name: 'Enregistrer le Délai par défaut' }).click();

    await expect(page).toHaveURL(/\/candidats$/);
    await expect(delay.getByRole('spinbutton', { name: 'Délai par défaut, en mois' })).toHaveValue('6');
    await expect(delay.getByRole('alert')).toHaveCount(0);
  });
});
