import { expect, test } from '@playwright/test';

// test/seed-front.ts gives Sacha a Profil of two files; only these tests change it, and leave it as found
test.describe('Profil of a Candidat', () => {
  test('shows the files of the Profil and saves the one modified', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Sacha');
    await page.getByRole('button', { name: 'Choisir' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Sacha');

    await page.getByRole('link', { name: 'Profil', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil de Sacha');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['cv.md', 'faits.md', 'Nouveau fichier']);
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

  test('creates a file of the Profil, edits it, then deletes it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Sacha');
    await page.getByRole('button', { name: 'Choisir' }).click();
    await page.getByRole('link', { name: 'Profil', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil de Sacha');

    const creation = page.getByRole('region', { name: 'Nouveau fichier' });
    await creation.getByRole('textbox', { name: 'Nom du fichier' }).fill('../faits.md');
    await creation.getByRole('button', { name: 'Créer le fichier' }).click();
    await expect(creation.getByRole('alert')).toContainText("« ../faits.md » n'est pas un nom de fichier du Profil");
    await creation.getByRole('textbox', { name: 'Nom du fichier' }).fill('lettre-tj-lille-2025.md');
    await creation.getByRole('textbox', { name: /^Contenu/ }).fill('# Lettre au TJ de Lille\n');
    await creation.getByRole('button', { name: 'Créer le fichier' }).click();

    const lettre = page.getByRole('region', { name: 'lettre-tj-lille-2025.md' });
    await expect(lettre.getByRole('textbox')).toHaveValue('# Lettre au TJ de Lille\n');
    await expect(creation.getByRole('textbox', { name: 'Nom du fichier' })).toHaveValue('');
    await lettre.getByRole('textbox').fill('# Lettre au TJ de Lille\n\nMadame la Présidente,\n');
    await lettre.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(lettre.getByText('Modifications non enregistrées')).toBeHidden();
    await page.reload();
    await expect(page.getByRole('region', { name: 'lettre-tj-lille-2025.md' }).getByRole('textbox')).toHaveValue(
      '# Lettre au TJ de Lille\n\nMadame la Présidente,\n',
    );

    await lettre.getByText('Supprimer lettre-tj-lille-2025.md…').click();
    await lettre.getByRole('button', { name: 'Supprimer définitivement lettre-tj-lille-2025.md' }).click();
    await expect(lettre).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['cv.md', 'faits.md', 'Nouveau fichier']);
  });

  test('says how to fill an empty Profil', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Camille');
    await page.getByRole('button', { name: 'Choisir' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Camille');

    await page.getByRole('link', { name: 'Profil', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil de Camille');
    await expect(page.getByRole('code')).toHaveText('jf profil camille');
    await expect(page.getByRole('region', { name: /\.md$/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Nouveau fichier' })).toBeVisible();
  });
});
