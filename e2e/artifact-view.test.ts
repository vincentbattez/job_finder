import { expect, test } from './candidate.ts';

// These journeys change data, each on its own Posting that test/seed-front.ts prepared: Versailles has a
// Chosen Research v1 and a Draft v2, Bastia a Validated Research and a Draft Letter
const VERSAILLES_REFERENCE = '2026-2409178';
const BASTIA_REFERENCE = '2026-2426147';
const CORRECTED_RESEARCH_REFERENCE = '2026-2402432';
const COMPARED_LETTER_REFERENCE = '2026-2400177';
const PASTED_RESEARCH_REFERENCE = '2026-2404434';
const FILE_LETTER_REFERENCE = '2026-2407111';

const CORRECTED_LETTER = 'Madame la Première présidente,\n\nTitulaire d’un master 2 de droit privé obtenu en 2025.\n';

test('validates a Draft, which becomes the Chosen Version, the previous one staying Validated', async ({
  page,
  openPage,
}) => {
  await openPage(`/postings/${VERSAILLES_REFERENCE}?tab=research`);
  const research = page.getByRole('region', { name: 'Recherche' });
  const versionSelect = research.getByRole('combobox', { name: 'Version' });
  await expect(versionSelect).toHaveText('Version 2 · Brouillon');
  await expect(page.getByRole('tab', { name: 'Recherche (Brouillon)' })).toBeVisible();
  await expect(research.getByText('En attendant, la Version 1 reste la Version retenue.')).toBeVisible();
  await expect(
    research.getByRole('heading', { name: 'Recherche relancée : le pôle civil du TJ de Versailles' }),
  ).toBeVisible();

  await research.getByRole('button', { name: 'Valider la Version 2' }).click();

  await expect(page.getByText('Version 2 validée et retenue')).toBeVisible();
  await expect(research.getByText('Validée · retenue')).toBeVisible();
  await expect(research.getByRole('button', { name: 'Valider la Version 2' })).toBeHidden();
  await expect(page.getByRole('tab', { name: 'Recherche (Validée)' })).toBeVisible();
  // The previous Chosen Version stays Validated, no longer chosen
  await versionSelect.click();
  await page.getByRole('option', { name: /^Version 1/ }).click();
  await expect(versionSelect).toHaveText('Version 1 · Validée');
  await expect(research.getByText('Ancienne Version. La Version retenue est la 2.')).toBeVisible();
  await expect(
    research.getByRole('heading', { name: 'Recherche première : le pôle civil du TJ de Versailles' }),
  ).toBeVisible();
});

test('corrects a Draft Letter, validates it in marking the Posting Applied, finds it frozen, then undoes Applied', async ({
  page,
  openPage,
}) => {
  // Back To Apply, whatever a run stopped halfway left it at
  const response = await page.request.post(`/postings/${BASTIA_REFERENCE}/status`, { form: { status: 'to_apply' } });
  expect(response.ok()).toBe(true);
  await openPage(`/postings/${BASTIA_REFERENCE}?tab=letter`);
  const letter = page.getByRole('region', { name: 'Lettre de motivation' });
  await expect(letter.getByRole('combobox', { name: 'Version' })).toHaveText('Version 1 · Brouillon');

  await letter.getByRole('button', { name: 'Modifier' }).click();
  // The WYSIWYG, not its fallback, which only shows when it fails to load
  await expect(letter.locator('.mdxeditor')).toBeVisible();
  const textbox = letter.getByRole('textbox', { name: 'Texte de la Version 1' });
  await expect(textbox).toBeEnabled();
  await textbox.fill(CORRECTED_LETTER);
  await letter.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText('Version 1 enregistrée')).toBeVisible();
  await expect(letter.getByText('Titulaire d’un master 2 de droit privé obtenu en 2025.')).toBeVisible();
  // A correction keeps the Version a Draft: marking Applied asks first
  await page.getByRole('button', { name: 'Marquer Postulée' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Marquer l’Offre Postulée ?' });
  await expect(dialog).toContainText('Ta Lettre de motivation est encore un Brouillon (Version 1).');
  await dialog.getByRole('button', { name: 'Valider la Lettre de motivation et marquer Postulée' }).click();

  const stepBadge = page.locator('main > header [data-step]');
  await expect(stepBadge).toHaveText('Postulée');
  await expect(letter.getByText('Validée · retenue')).toBeVisible();
  await expect(
    letter.getByText('Offre Postulée : cette Lettre de motivation est figée telle qu’envoyée.'),
  ).toBeVisible();
  await expect(letter.getByRole('button', { name: 'Modifier' })).toBeDisabled();

  // A Letter written is not a Letter sent: the Candidate undoes Applied, and the Letter changes again
  await page.getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('menuitem', { name: 'Remettre À traiter (pas envoyée)' }).click();

  await expect(stepBadge).toHaveText('À traiter');
  await expect(page).toHaveURL(/\?tab=letter$/);
  await expect(letter.getByRole('button', { name: 'Modifier' })).toBeEnabled();
});

test('corrects a Research in the editor, keeping its component and its Validated state', async ({ page, openPage }) => {
  await openPage(`/postings/${CORRECTED_RESEARCH_REFERENCE}?tab=research`);
  const research = page.getByRole('region', { name: 'Recherche' });

  await research.getByRole('button', { name: 'Modifier' }).click();
  // The component of the catalogue shows its name and its attributes, editable through its descriptor
  await expect(research.getByRole('textbox', { name: 'Attribut type' })).toHaveValue('warning');
  await research.getByText('Le tribunal recrute deux attachés.').click();
  await page.keyboard.type(' Relu par Léa.');
  await research.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText('Version 1 enregistrée')).toBeVisible();
  await expect(research.getByText(/Relu par Léa\./)).toBeVisible();
  await expect(research.getByRole('note').getByText('Date à vérifier.')).toBeVisible();
  await expect(research.getByText('Validée · retenue')).toBeVisible();
});

test('compares a corrected Letter with its Original, side by side then in tabs on a phone', async ({
  page,
  openPage,
}) => {
  await openPage(`/postings/${COMPARED_LETTER_REFERENCE}?tab=letter`);
  const letter = page.getByRole('region', { name: 'Lettre de motivation' });

  await letter.getByRole('button', { name: 'Modifier' }).click();
  await letter
    .getByRole('textbox', { name: 'Texte de la Version 1' })
    .fill(
      'Madame la Présidente,\n\nPremier paragraphe.\n\nDeuxième paragraphe.\n\nTroisième paragraphe.\n\nParagraphe corrigé par Léa.\n\nCordialement,',
    );
  await letter.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Version 1 enregistrée')).toBeVisible();

  await letter.getByRole('button', { name: 'Comparer à l’Original' }).click();

  await expect(letter.getByText('1 passage corrigé depuis l’Original')).toBeVisible();
  const original = letter.getByRole('region', { name: 'Original, écrit par l’IA' });
  const corrected = letter.getByRole('region', { name: 'Ta Version' });
  await expect(original.getByText('Paragraphe à corriger.')).toBeVisible();
  await expect(corrected.getByText('Paragraphe corrigé par Léa.')).toBeVisible();
  // What did not change is folded, and the Original offers nothing to edit
  await expect(original.getByText('Deuxième paragraphe.')).toBeHidden();
  await expect(original.getByRole('textbox')).toHaveCount(0);
  // Only the corrected passage is highlighted: the closing paragraph, identical, stays out of it
  await expect(corrected.locator('[data-change]')).toHaveCount(1);
  await expect(corrected.locator('[data-change]')).not.toContainText('Cordialement');
  await original.getByRole('button', { name: '4 passages identiques' }).click();
  await expect(original.getByText('Deuxième paragraphe.')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 800 });
  await letter.getByRole('tab', { name: 'Original' }).click();
  await expect(letter.getByText('Paragraphe à corriger.')).toBeVisible();
  await letter.getByRole('tab', { name: 'Ta Version' }).click();
  await expect(letter.getByText('Paragraphe corrigé par Léa.')).toBeVisible();
});

test('brings a pasted Research as a Draft with no Original, then validates it', async ({ page, openPage }) => {
  await openPage(`/postings/${PASTED_RESEARCH_REFERENCE}?tab=research`);
  const research = page.getByRole('region', { name: 'Recherche' });

  await research.getByRole('button', { name: 'Ajouter la mienne' }).click();
  const dialog = page.getByRole('dialog', { name: /Ajouter ta propre Version/ });
  await dialog.getByRole('textbox', { name: 'Ton texte' }).fill('# Ma Recherche collée\n\nLe greffe m’a répondu.\n');
  await dialog.getByRole('button', { name: 'Ajouter en Brouillon' }).click();

  await expect(page.getByText('Ta Version arrive en Brouillon')).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(research.getByRole('heading', { name: 'Ma Recherche collée' })).toBeVisible();
  await expect(research.getByRole('button', { name: 'Comparer à l’Original' })).toBeDisabled();

  await research.getByRole('button', { name: /^Valider la Version/ }).click();

  await expect(research.getByText('Validée · retenue')).toBeVisible();
});

test('brings a Letter from a Markdown file, then validates it', async ({ page, openPage }) => {
  await openPage(`/postings/${FILE_LETTER_REFERENCE}?tab=letter`);
  const letter = page.getByRole('region', { name: 'Lettre de motivation' });

  await letter.getByRole('button', { name: 'Ajouter la mienne' }).click();
  const dialog = page.getByRole('dialog', { name: /Ajouter ta propre Version/ });
  await dialog.getByRole('tab', { name: 'Fichier .md' }).click();
  await dialog.getByLabel('Choisir un fichier').setInputFiles({
    name: 'ma-lettre.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('Madame la Présidente,\n\nMa Lettre écrite à la main.\n'),
  });
  await expect(dialog.getByText(/ma-lettre\.md/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Ajouter en Brouillon' }).click();

  await expect(page.getByText('Ta Version arrive en Brouillon')).toBeVisible();
  await expect(letter.getByText('Ma Lettre écrite à la main.')).toBeVisible();

  await letter.getByRole('button', { name: /^Valider la Version/ }).click();

  await expect(letter.getByText('Validée · retenue')).toBeVisible();
});
