import { expect, test } from '@playwright/test';

// test/seed-front.ts gives Sacha a Profil of two files; only this test changes it
test.describe('Profil of a Candidat', () => {
  test('shows the files of the Profil and saves the one modified', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Sacha');
    await page.getByRole('button', { name: 'Choisir' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Sacha');

    await page.getByRole('link', { name: 'Profil', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil de Sacha');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['cv.md', 'faits.md']);
    const faits = page.getByRole('region', { name: 'faits.md' });
    await expect(faits.getByRole('textbox')).toHaveValue('# Faits\n\n## Mobilité\n\n- Lille et alentours\n');
    await faits.getByRole('textbox').fill('# Faits\n\n## Mobilité\n\n- Lille, Arras et Béthune\n');
    await expect(faits.getByText('Modifications non enregistrées')).toBeVisible();
    await faits.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(faits.getByText('Modifications non enregistrées')).toBeHidden();
    await page.reload();
    await expect(page.getByRole('region', { name: 'faits.md' }).getByRole('textbox')).toHaveValue(
      '# Faits\n\n## Mobilité\n\n- Lille, Arras et Béthune\n',
    );
    await expect(page.getByRole('region', { name: 'cv.md' }).getByRole('textbox')).toHaveValue(
      '# CV de Sacha\n\n## Formation\n\n- Master 2 droit public\n',
    );
  });

  test('says how to fill an empty Profil', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Camille');
    await page.getByRole('button', { name: 'Choisir' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Camille');

    await page.getByRole('link', { name: 'Profil', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil de Camille');
    await expect(page.getByRole('code')).toHaveText('jf profil camille');
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });
});
