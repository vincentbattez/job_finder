import { expect, test, type Page } from '@playwright/test';

// Jade's Veilles, which this test alone changes (test/seed-front.ts): any an earlier run left is
// deleted first
async function openJadeVeilles(page: Page) {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Jade');
  await page.getByRole('button', { name: 'Choisir' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Jade');
  await page.getByRole('link', { name: 'Profil', exact: true }).click();
  const veilles = page.getByRole('region', { name: 'Veilles' });
  // Disabled until React hydrates: a click before would go nowhere
  await expect(veilles.getByRole('button', { name: 'Créer la Veille' })).toBeEnabled();
  const leftList = veilles.getByRole('group', { name: /^Veille jade-/ });
  while ((await leftList.count()) > 0) {
    const count = await leftList.count();
    await leftList.first().getByRole('button', { name: 'Supprimer la Veille' }).click();
    await expect(leftList).toHaveCount(count - 1);
  }
  return veilles;
}

// The form of a Veille, built from the descriptor of its Source (ADR-0010)
test('creates, changes and deletes a Veille of the Profile', async ({ page }) => {
  const veilles = await openJadeVeilles(page);
  const creation = veilles.getByRole('group', { name: 'Nouvelle Veille' });

  await creation.getByRole('combobox', { name: 'Source' }).selectOption('Place de l’Emploi Public');
  await creation.getByRole('textbox', { name: 'Titre recherché' }).fill('greffier');
  await creation.getByRole('textbox', { name: 'Cours d’appel de la Zone, une par ligne' }).fill('Douai\nAmiens');
  await creation.getByRole('button', { name: 'Créer la Veille' }).click();

  const veille = veilles.getByRole('group', { name: 'Veille jade-1' });
  await expect(veille.getByRole('textbox', { name: 'Titre recherché' })).toHaveValue('greffier');
  await expect(veille.getByRole('textbox', { name: 'Cours d’appel de la Zone, une par ligne' })).toHaveValue(
    'Douai\nAmiens',
  );
  await expect(creation.getByRole('textbox', { name: 'Titre recherché' })).toHaveValue('');

  await veille.getByRole('textbox', { name: 'Cours d’appel de la Zone, une par ligne' }).fill('Paris');
  await veille.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(veille.getByRole('status')).toHaveText('Veille enregistrée.');
  await page.reload();
  await expect(veille.getByRole('textbox', { name: 'Cours d’appel de la Zone, une par ligne' })).toHaveValue('Paris');
  // React hydrating a textarea puts back its saved text over what was typed: wait for it first
  await expect(veille.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();

  await veille.getByRole('textbox', { name: 'Cours d’appel de la Zone, une par ligne' }).fill(' \n ');
  await veille.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(veille.getByRole('alert')).toHaveText(
    "La Source Place de l’Emploi Public attend d'autres Paramètres : renseigner « Cours d’appel de la Zone ».",
  );

  await veille.getByRole('button', { name: 'Supprimer la Veille' }).click();
  await expect(veilles.getByRole('group', { name: /^Veille jade-/ })).toHaveCount(0);
});
