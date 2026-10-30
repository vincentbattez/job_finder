import path from 'node:path';

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
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Faits',
      'Pièces',
      'cv.md',
      'faits.md',
      'Nouveau fichier',
    ]);
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
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Faits',
      'Pièces',
      'cv.md',
      'faits.md',
      'Nouveau fichier',
    ]);
  });

  test('shows in faits.md what the form of the Faits saves, and in the form what faits.md says', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Sacha');
    await page.getByRole('button', { name: 'Choisir' }).click();
    await page.getByRole('link', { name: 'Profil', exact: true }).click();

    const faitsMarkdown = page.getByRole('region', { name: 'faits.md' }).getByRole('textbox');
    const foundMarkdown = await faitsMarkdown.inputValue();
    const faitsForm = page.getByRole('region', { name: 'Faits', exact: true });
    await faitsForm.getByRole('textbox', { name: 'Identité' }).fill('Sacha Morel');
    const experiences = faitsForm.getByRole('group', { name: 'Expériences' });
    await experiences.getByRole('button', { name: 'Ajouter' }).click();
    await experiences.getByRole('textbox', { name: 'Entrée 1' }).fill('Juriste, Mairie de Lens, 2026');
    await faitsForm.getByRole('button', { name: 'Enregistrer les Faits' }).click();

    await expect(faitsMarkdown).toHaveValue(/## Identité\n\nSacha Morel\n/);
    await expect(faitsMarkdown).toHaveValue(/## Expériences\n\n- Juriste, Mairie de Lens, 2026\n/);
    await expect(faitsMarkdown).toHaveValue(/## Mobilité\n/);

    const markdown = await faitsMarkdown.inputValue();
    await faitsMarkdown.fill(
      `${markdown.replace('Sacha Morel', 'Sacha Morel-Durand')}\n## Compétences\n\nDroit public\n`,
    );
    await page.getByRole('region', { name: 'faits.md' }).getByRole('button', { name: 'Enregistrer' }).click();

    await expect(faitsForm.getByRole('textbox', { name: 'Identité' })).toHaveValue('Sacha Morel-Durand');
    await expect(faitsForm.getByRole('textbox', { name: 'Compétences' })).toHaveValue('Droit public');
    await expect(experiences.getByRole('textbox', { name: 'Entrée 1' })).toHaveValue('Juriste, Mairie de Lens, 2026');

    await faitsMarkdown.fill(foundMarkdown);
    await page.getByRole('region', { name: 'faits.md' }).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(faitsForm.getByRole('textbox', { name: 'Identité' })).toHaveValue('');
  });

  test('keeps a dropped PDF as a Pièce, refuses a file that is not one, then deletes it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Sacha');
    await page.getByRole('button', { name: 'Choisir' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Sacha');
    await page.getByRole('link', { name: 'Profil', exact: true }).click();
    const pieces = page.getByRole('region', { name: 'Pièces' });
    await expect(pieces.getByText('Aucune Pièce pour l’instant.')).toBeVisible();
    // Disabled until React hydrates: a file chosen before would go nowhere
    await expect(pieces.getByLabel('Déposer une Pièce')).toBeEnabled();

    await pieces
      .getByLabel('Déposer une Pièce')
      .setInputFiles({ name: 'cv.md', mimeType: 'text/markdown', buffer: Buffer.from('# CV\n') });
    await expect(pieces.getByRole('alert')).toContainText("« cv.md » n'est pas un nom de Pièce");
    await pieces
      .getByLabel('Déposer une Pièce')
      .setInputFiles(path.join(import.meta.dirname, '../test/fixtures/profil/cv.pdf'));

    await expect(pieces.getByRole('listitem')).toHaveCount(1);
    await expect(pieces.getByRole('listitem')).toContainText('cv.pdf');
    await expect(pieces.getByRole('listitem')).toContainText('déposée le');
    await expect(pieces.getByRole('alert')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Faits',
      'Pièces',
      'cv.md',
      'faits.md',
      'Nouveau fichier',
    ]);
    await expect(pieces.getByRole('listitem')).toContainText('cv.pdf');

    await pieces.getByText('Supprimer cv.pdf…').click();
    await pieces.getByRole('button', { name: 'Supprimer définitivement cv.pdf' }).click();
    await expect(pieces.getByText('Aucune Pièce pour l’instant.')).toBeVisible();
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
