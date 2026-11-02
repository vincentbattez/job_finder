import { expect, test, type IFront } from './candidate.ts';
import { unfoldChosenVersion } from './version.ts';

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
      'Lettre',
      'Portrait',
      'Fiche d’entretien',
    ]);
    const letter = page.getByRole('region', { name: 'Lettre' });
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
    const letter = page.getByRole('region', { name: 'Lettre' });

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

  test('tells which Instructions produced each Version, and shows them folded to compare', async ({ page }) => {
    await page.goto('/postings/2026-2409247');

    const research = page.getByRole('region', { name: 'Recherche' });
    await expect(research.locator('li > details > summary')).toHaveText([
      /^v1.*Consignes par défaut/,
      /^v2.*Consignes du Candidat/,
    ]);
    // v2, the Chosen Version, unfolds like any other; its Instructions stay folded until asked
    const v2 = research.locator('li').filter({ has: page.locator('summary', { hasText: /^v2/ }) });
    await unfoldChosenVersion(research);
    await expect(research.getByText('Creuse la ville.')).toBeHidden();
    await v2.getByText('Consignes de cette Version').click();
    await expect(v2.getByText('Creuse la ville.')).toBeVisible();
  });
});
