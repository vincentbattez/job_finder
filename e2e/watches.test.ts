import type { Page } from '@playwright/test';

import { expect, test } from './candidate.ts';

// The toast a mutation ends in (DESIGN.md « Feedback »)
function toastOf(page: Page, text: string | RegExp) {
  return page.locator('[data-sonner-toast]').filter({ hasText: text });
}

// Deletes a Watch through its AlertDialog
async function deleteWatch(page: Page, label: string) {
  await page.getByRole('button', { name: `Supprimer la Veille « ${label} »` }).click();
  const dialog = page.getByRole('alertdialog', { name: `Supprimer la Veille « ${label} » ?` });
  await dialog.getByRole('button', { name: 'Supprimer la Veille' }).click();
  await expect(dialog).toBeHidden();
}

// Jade's Watches, which this test alone changes (test/seed-front.ts): any an earlier run left is
// deleted first
test('creates, changes and deletes a Watch', async ({ page, asCandidate, openPage }) => {
  await asCandidate('jade');
  await openPage('/watches');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Veilles');
  const creation = page.getByRole('region', { name: 'Nouvelle Veille' });
  for (const label of ['greffier', 'attaché de justice']) {
    if ((await page.getByRole('region', { name: label, exact: true }).count()) > 0) {
      await deleteWatch(page, label);
    }
  }
  await expect(page.getByText('Aucune Veille pour l’instant')).toBeVisible();

  await creation.getByRole('combobox', { name: 'Source' }).selectOption('Place de l’Emploi Public');
  await creation.getByRole('textbox', { name: 'Titre recherché' }).fill('greffier');
  await creation.getByRole('button', { name: 'Créer la Veille' }).click();

  await expect(toastOf(page, 'Veille créée.')).toBeVisible();
  const created = page.getByRole('region', { name: 'greffier', exact: true });
  await expect(created.getByRole('textbox', { name: 'Titre recherché' })).toHaveValue('greffier');
  await expect(created).toContainText('Pas encore détectée');
  await expect(creation.getByRole('textbox', { name: 'Titre recherché' })).toHaveValue('');

  await created.getByRole('textbox', { name: 'Titre recherché' }).fill('attaché de justice');
  await created.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(toastOf(page, 'Veille enregistrée.')).toBeVisible();
  const changed = page.getByRole('region', { name: 'attaché de justice', exact: true });
  await expect(changed).toBeVisible();
  // React hydrating a field puts back its saved value over what was typed: openPage waits for it
  await openPage('/watches');
  await expect(changed.getByRole('textbox', { name: 'Titre recherché' })).toHaveValue('attaché de justice');

  // Blank, which the field's required lets through, but not the Source
  await changed.getByRole('textbox', { name: 'Titre recherché' }).fill(' ');
  await changed.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(toastOf(page, /attend d'autres Paramètres\s: renseigner « Titre recherché »/)).toBeVisible();

  // Kept when the dialog is dismissed
  await page.getByRole('button', { name: 'Supprimer la Veille « attaché de justice »' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Garder la Veille' }).click();
  await expect(changed).toBeVisible();

  await deleteWatch(page, 'attaché de justice');
  await expect(toastOf(page, 'Veille supprimée.')).toBeVisible();
  await expect(changed).toHaveCount(0);
});

// Léa's Watch, past its first launch in the seed, whose recorded PEP search set four titles aside
test('shows the last Detection of a Watch and its Near Misses under their anchor', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('lea');
  await openPage('/watches');
  const watch = page.getByRole('region', { name: 'attaché de justice', exact: true });
  await expect(watch).toContainText('Place de l’Emploi Public');
  await expect(watch).toContainText('Dernière Détection le');

  await watch.getByRole('link', { name: '4 titres écartés de peu' }).click();

  await expect(page).toHaveURL(/\/watches#near-misses$/);
  const nearMisses = page.getByRole('region', { name: 'Titres écartés de peu' });
  await expect(nearMisses).toBeInViewport();
  await expect(nearMisses.getByRole('heading', { level: 3 })).toHaveText(['attaché de justice']);
  await expect(nearMisses.getByRole('listitem')).toHaveCount(4);
  await expect(nearMisses).toContainText('Chef du pôle des attachés de justice et des assistants spécialisés');
  await expect(nearMisses).toContainText('2026-2431315');
});
