import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

// The fake Claude of test/e2e-actions.server.ts extracts this Fiche de poste: a ville outside
// Hauts-de-France, whose Offres the région filter of the map counts
const FICHE_DE_POSTE = readFileSync(
  path.join(import.meta.dirname, '..', 'test', 'fixtures', 'import', 'greffier-grenoble.md'),
  'utf8',
);
const TITLE = 'Greffier placé – Tribunal judiciaire de Grenoble';

// The worker takes the queued Recherche, its session lasts a second, and the fiche reads the état
// again every two seconds
const READY_TIMEOUT_MS = 15_000;

test('imports a Fiche de poste dropped on the Offres, which then shows among them with its Recherche', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Léa');
  await page.getByRole('button', { name: 'Choisir' }).click();
  // The drop needs React, which enables the field once it runs
  await expect(page.getByLabel('Importer une Fiche de poste')).toBeEnabled();

  const dataTransfer = await page.evaluateHandle((markdown) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([markdown], 'greffier-grenoble.md', { type: 'text/markdown' }));
    return transfer;
  }, FICHE_DE_POSTE);
  await page.getByText('Glissez ici une Fiche de poste en Markdown').dispatchEvent('drop', { dataTransfer });

  await expect(page.getByText(`Offre importée : ${TITLE}`)).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(TITLE) });
  await expect(row.getByRole('cell').last()).toHaveText('15/12/2026');
  await row.getByRole('link', { name: TITLE }).click();
  await expect(page.getByRole('region', { name: 'Recherche' }).getByRole('status')).toHaveText('Prêt', {
    timeout: READY_TIMEOUT_MS,
  });
});
