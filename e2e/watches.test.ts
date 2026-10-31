import type { Page } from '@playwright/test';

import { expect, test } from './candidate.ts';

// Jade's Watches, which this test alone changes (test/seed-front.ts): any an earlier run left is
// deleted first
async function openJadeWatches(page: Page) {
  await page.goto('/profile');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil de Jade');
  const watches = page.getByRole('region', { name: 'Veilles' });
  // Disabled until React hydrates: a click before would go nowhere
  await expect(watches.getByRole('button', { name: 'Créer la Veille' })).toBeEnabled();
  const leftList = watches.getByRole('group', { name: /^Veille jade-/ });
  while ((await leftList.count()) > 0) {
    const count = await leftList.count();
    await leftList.first().getByRole('button', { name: 'Supprimer la Veille' }).click();
    await expect(leftList).toHaveCount(count - 1);
  }
  return watches;
}

// The form of a Watch, built from the descriptor of its Source (ADR-0010)
test('creates, changes and deletes a Watch of the Profile', async ({ page, asCandidate }) => {
  await asCandidate('jade');
  const watches = await openJadeWatches(page);
  const creation = watches.getByRole('group', { name: 'Nouvelle Veille' });

  await creation.getByRole('combobox', { name: 'Source' }).selectOption('Place de l’Emploi Public');
  await creation.getByRole('textbox', { name: 'Titre recherché' }).fill('greffier');
  await creation.getByRole('textbox', { name: 'Cours d’appel de la Zone, une par ligne' }).fill('Douai\nAmiens');
  await creation.getByRole('button', { name: 'Créer la Veille' }).click();

  const watch = watches.getByRole('group', { name: 'Veille jade-1' });
  await expect(watch.getByRole('textbox', { name: 'Titre recherché' })).toHaveValue('greffier');
  await expect(watch.getByRole('textbox', { name: 'Cours d’appel de la Zone, une par ligne' })).toHaveValue(
    'Douai\nAmiens',
  );
  await expect(creation.getByRole('textbox', { name: 'Titre recherché' })).toHaveValue('');

  await watch.getByRole('textbox', { name: 'Cours d’appel de la Zone, une par ligne' }).fill('Paris');
  await watch.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(watch.getByRole('status')).toHaveText('Veille enregistrée.');
  await page.reload();
  await expect(watch.getByRole('textbox', { name: 'Cours d’appel de la Zone, une par ligne' })).toHaveValue('Paris');
  // React hydrating a textarea puts back its saved text over what was typed: wait for it first
  await expect(watch.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();

  await watch.getByRole('textbox', { name: 'Cours d’appel de la Zone, une par ligne' }).fill(' \n ');
  await watch.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(watch.getByRole('alert')).toHaveText(
    "La Source Place de l’Emploi Public attend d'autres Paramètres : renseigner « Cours d’appel de la Zone ».",
  );

  await watch.getByRole('button', { name: 'Supprimer la Veille' }).click();
  await expect(watches.getByRole('group', { name: /^Veille jade-/ })).toHaveCount(0);
});
