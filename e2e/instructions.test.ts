import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './candidate.ts';
import { openGeneration } from './generation.ts';
import { findDataDirectory } from './harness.ts';

// Ugo's one Posting, which test/seed-front.ts imports and only this file opens; the import names it from
// its Markdown (src/modules/source-import)
const UGO_JOB_DESCRIPTION = '# Greffier – Vienne\n\nAccueillir le public du tribunal judiciaire de Vienne.\n';
const UGO_REFERENCE = `import-${createHash('sha256').update(UGO_JOB_DESCRIPTION).digest('hex').slice(0, 10)}`;

// Back to the default Instructions, as an earlier run may have left the Candidate's own
function deleteInstructionsOf(candidateId: string): void {
  const dataDirectory = findDataDirectory();
  rmSync(path.join(dataDirectory, 'candidates', candidateId, 'instructions'), { recursive: true, force: true });
}

// The toast a mutation ends in (DESIGN.md « Feedback »)
function toastOf(page: Page, text: string) {
  return page.locator('[data-sonner-toast]').filter({ hasText: text });
}

test('edits the Instructions in the generation panel: unsaved ones block Launch, saved ones are the next runs’', async ({
  page,
  context,
  asCandidate,
  openPage,
}) => {
  deleteInstructionsOf('ugo');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await asCandidate('ugo');
  await openPage(`/postings/${UGO_REFERENCE}?tab=research`);
  const panel = await openGeneration(page, page.getByRole('region', { name: 'Recherche' }));
  await panel.getByRole('button', { name: 'Continuer' }).click();

  // Step 2: the default Instructions, editable, then the Fixed Part folded, its substituted values marked
  await expect(panel.getByText('Consignes par défaut', { exact: true })).toBeVisible();
  const editor = panel.getByRole('textbox', { name: 'Consignes · Recherche' });
  await expect(editor).toHaveValue(/\S/);
  const defaultInstructions = await editor.inputValue();
  await expect(panel.getByText('remplacé automatiquement pour cette Offre')).toBeHidden();
  await panel.getByRole('button', { name: /Partie fixe du Prompt/ }).click();
  await expect(panel.getByText('remplacé automatiquement pour cette Offre')).toBeVisible();
  await expect(panel.locator('mark').filter({ hasText: UGO_REFERENCE }).first()).toBeVisible();
  await expect(panel.getByRole('textbox')).toHaveCount(1);

  // Edited and left unsaved, they block Launch, among the blockers of the recap
  await editor.fill('Cherche surtout la vie du greffe.\n');
  await expect(panel.getByText('Modifiées, pas encore enregistrées')).toBeVisible();
  await panel.getByRole('button', { name: 'Continuer' }).click();
  const unsavedBlocker = panel.getByRole('listitem').filter({ hasText: 'Consignes modifiées' });
  await expect(unsavedBlocker).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Lancer', exact: true })).toBeDisabled();

  // Discarded, the defaults come back
  await panel.getByRole('button', { name: 'Retour' }).click();
  await panel.getByRole('button', { name: 'Annuler mes modifications' }).click();
  await expect(editor).toHaveValue(defaultInstructions);
  await expect(panel.getByText('Modifiées, pas encore enregistrées')).toBeHidden();

  // Saved, they become Ugo's, and the Prompt of the run ends with them
  await editor.fill('Cherche surtout la vie du greffe.\n');
  await panel.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(toastOf(page, 'Consignes enregistrées')).toBeVisible();
  await expect(panel.getByText('Tes Consignes', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Continuer' }).click();
  await expect(unsavedBlocker).toBeHidden();
  await expect(panel.getByRole('button', { name: 'Lancer', exact: true })).toBeEnabled();
  await panel.getByRole('button', { name: 'Copier le Prompt' }).click();
  await expect(toastOf(page, 'Prompt copié')).toBeVisible();
  const prompt = await page.evaluate(() => globalThis.navigator.clipboard.readText());
  expect(prompt.trimEnd()).toMatch(/Cherche surtout la vie du greffe\.$/);

  // Restored, the defaults are in effect again
  await panel.getByRole('button', { name: 'Retour' }).click();
  await panel.getByRole('button', { name: 'Rétablir celles par défaut' }).click();
  await expect(toastOf(page, 'Consignes par défaut rétablies')).toBeVisible();
  await expect(panel.getByText('Consignes par défaut', { exact: true })).toBeVisible();
  await expect(editor).toHaveValue(defaultInstructions);
});

test('replaces the Instructions of each type of Artifact from the Settings, then restores the defaults', async ({
  page,
  asCandidate,
  openPage,
}) => {
  deleteInstructionsOf('sacha');
  await asCandidate('sacha');
  await openPage('/settings');
  const section = page.getByRole('region', { name: 'Consignes', exact: true });
  await expect(section.getByRole('heading', { level: 3 })).toHaveText([
    'Recherche',
    'Lettre de motivation',
    'Portrait',
    'Fiche d’entretien',
  ]);
  const letter = section.getByRole('region', { name: 'Lettre de motivation' });
  const editor = letter.getByRole('textbox', { name: 'Consignes · Lettre de motivation' });
  await expect(letter.getByText('Consignes par défaut', { exact: true })).toBeVisible();
  await expect(editor).toHaveValue(/^Écris une lettre de motivation d'une page/);
  // The Fixed Part of every Prompt holds this rule: no field of the page carries it
  const textboxList = await section.getByRole('textbox').all();
  expect(textboxList).toHaveLength(4);
  for (const textbox of textboxList) {
    await expect(textbox).not.toHaveValue(/N'invente jamais un fait/);
  }

  await editor.fill('Une lettre courte, au ton direct.\n');
  await expect(letter.getByText('Modifiées, pas encore enregistrées')).toBeVisible();
  await letter.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(toastOf(page, 'Consignes enregistrées')).toBeVisible();
  await expect(letter.getByText('Tes Consignes', { exact: true })).toBeVisible();
  await openPage('/settings');
  await expect(editor).toHaveValue('Une lettre courte, au ton direct.\n');
  await expect(
    section.getByRole('region', { name: 'Recherche' }).getByText('Consignes par défaut', { exact: true }),
  ).toBeVisible();

  await letter.getByRole('button', { name: 'Rétablir celles par défaut' }).click();
  await expect(toastOf(page, 'Consignes par défaut rétablies')).toBeVisible();
  await expect(letter.getByText('Consignes par défaut', { exact: true })).toBeVisible();
  await expect(editor).toHaveValue(/^Écris une lettre de motivation d'une page/);
});

// Léa's Posting 2026-2409247 has a Research made with the default Instructions, then one with hers
test('tells which Instructions produced each Version, and shows them folded to compare', async ({ page, openPage }) => {
  // Once React runs the page: hydration would fold back a Version unfolded before it
  await openPage('/postings/2026-2409247?tab=research');

  const research = page.getByRole('region', { name: 'Recherche' });
  // v2, the latest, read first; its Instructions stay folded until asked
  const instructions = research.getByText(/· Consignes de cette Version$/);
  await expect(instructions).toHaveText('Consignes du Candidat · Consignes de cette Version');
  await expect(research.getByText('Creuse la ville.')).toBeHidden();
  await instructions.click();
  await expect(research.getByText('Creuse la ville.')).toBeVisible();
  await research.getByRole('combobox', { name: 'Version' }).click();
  await page.getByRole('option', { name: /^Version 1/ }).click();
  await expect(instructions).toHaveText('Consignes par défaut · Consignes de cette Version');
});
