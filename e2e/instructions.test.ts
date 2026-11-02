import { expect, test, type IFront } from './candidate.ts';

// Sacha's Instructions are the ones these tests change; test/seed-front.ts leaves them to the default
// ones. Léa's Posting 2026-2409247 has a Research made with the default Instructions, then one with hers.
// Sacha's, once asCandidate chose him
async function openInstructionsOfSacha({ page, openPage }: IFront) {
  await openPage('/instructions');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Consignes de Sacha');
}

test.describe('Instructions of a Candidate', () => {
  test('shows the default Instructions of each module, and never the fixed part as editable', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await asCandidate('sacha');
    await openInstructionsOfSacha({ page, openPage });

    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Recherche',
      'Lettre de motivation',
      'Portrait',
      'Fiche d’entretien',
    ]);
    const letter = page.getByRole('region', { name: 'Lettre de motivation' });
    await expect(letter.getByText('Consignes par défaut', { exact: true })).toBeVisible();
    await expect(letter.getByRole('textbox')).toHaveValue(/^Écris une lettre de motivation d'une page/);
    // The fixed part of every prompt holds this rule: no field of the page carries it
    const textboxList = await page.getByRole('textbox').all();
    expect(textboxList).toHaveLength(4);
    for (const textbox of textboxList) {
      await expect(textbox).not.toHaveValue(/N'invente jamais un fait/);
    }
  });

  test('creates the Candidate’s own Instructions, modifies them, then deletes them for the default ones', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await asCandidate('sacha');
    await openInstructionsOfSacha({ page, openPage });
    const letter = page.getByRole('region', { name: 'Lettre de motivation' });

    await letter.getByRole('textbox').fill('Une lettre courte, au ton direct.\n');
    await expect(letter.getByText('Modifications non enregistrées')).toBeVisible();
    await letter.getByRole('button', { name: 'Enregistrer mes Consignes' }).click();
    await expect(letter.getByText('Vos Consignes', { exact: true })).toBeVisible();
    await letter.getByRole('textbox').fill('Une lettre très courte.\n');
    await letter.getByRole('button', { name: 'Enregistrer mes Consignes' }).click();
    await expect(letter.getByText('Modifications non enregistrées')).toBeHidden();
    await page.reload();
    await expect(letter.getByRole('textbox')).toHaveValue('Une lettre très courte.\n');
    await expect(
      page.getByRole('region', { name: 'Recherche' }).getByText('Consignes par défaut', { exact: true }),
    ).toBeVisible();

    await letter.getByRole('button', { name: 'Revenir aux Consignes par défaut' }).click();

    await expect(letter.getByText('Consignes par défaut', { exact: true })).toBeVisible();
    await expect(letter.getByRole('textbox')).toHaveValue(/^Écris une lettre de motivation d'une page/);
  });

  test('tells which Instructions produced each Version, and shows them folded to compare', async ({
    page,
    openPage,
  }) => {
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
});
