import { expect, type Locator, type Page } from '@playwright/test';

// The Generate or Regenerate button never runs: it opens the generation panel (spec #125)
export async function openGeneration(page: Page, artifact: Locator): Promise<Locator> {
  await artifact.getByRole('button', { name: /^(?:Générer|Régénérer)$/ }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByRole('button', { name: 'Continuer' })).toBeVisible();
  return panel;
}

// Through the panel's steps to its recap, the Inputs checked as it opened
export async function goToRecap(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: 'Continuer' }).click();
  await panel.getByRole('button', { name: 'Continuer' }).click();
  await expect(panel.getByRole('button', { name: 'Lancer', exact: true })).toBeVisible();
}

// Opens the panel, launches the run as it opens, then lets it run in the background; the fake session may
// be done already
export async function generate(page: Page, artifact: Locator): Promise<void> {
  const panel = await openGeneration(page, artifact);
  await goToRecap(panel);
  await panel.getByRole('button', { name: 'Lancer', exact: true }).click();
  await panel.getByRole('button', { name: /^(?:Fermer, la génération continue|Voir le Brouillon)$/ }).click();
  await expect(panel).toBeHidden();
}
