import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod/v4';

// Each test changes the Profile of a Candidate of its own (test/seed-front.ts), which it puts back
// first, as jf profile would have written it: a test that failed halfway leaves nothing behind
async function openFreshProfileOf(
  page: Page,
  { id, name }: Readonly<{ id: string; name: string }>,
  { hasCv = true }: Readonly<{ hasCv?: boolean }> = {},
) {
  const { dataDirectory } = z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata);
  const profileDirectory = path.join(dataDirectory, 'candidates', id, 'profile');
  rmSync(profileDirectory, { recursive: true, force: true });
  mkdirSync(profileDirectory, { recursive: true });
  if (hasCv) {
    writeFileSync(path.join(profileDirectory, 'cv.md'), `# CV de ${name}\n\n## Formation\n\n- Master 2 droit public\n`);
  }
  writeFileSync(path.join(profileDirectory, 'facts.md'), '# Faits\n\n## Mobilité\n\n- Lille et alentours\n');
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption(name);
  await page.getByRole('button', { name: 'Choisir' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Offres de ${name}`);
  await page.getByRole('link', { name: 'Profil', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Profil de ${name}`);
}

test.describe('Profile of a Candidate', () => {
  test('shows the files of the Profile and saves the one modified', async ({ page }) => {
    await openFreshProfileOf(page, { id: 'sacha', name: 'Sacha' });
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Faits',
      'Pièces',
      'cv.md',
      'facts.md',
      'Nouveau fichier',
      'Veilles',
      'Notifications',
    ]);
    const facts = page.getByRole('region', { name: 'facts.md' });
    await expect(facts.getByRole('textbox')).toHaveValue('# Faits\n\n## Mobilité\n\n- Lille et alentours\n');
    await facts.getByRole('textbox').fill('# Faits\n\n## Mobilité\n\n- Lille, Arras et Béthune\n');
    await expect(facts.getByText('Modifications non enregistrées')).toBeVisible();
    await facts.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(facts.getByText('Modifications non enregistrées')).toBeHidden();
    await page.reload();
    await expect(page.getByRole('region', { name: 'facts.md' }).getByRole('textbox')).toHaveValue(
      '# Faits\n\n## Mobilité\n\n- Lille, Arras et Béthune\n',
    );
    await expect(page.getByRole('region', { name: 'cv.md' }).getByRole('textbox')).toHaveValue(
      '# CV de Sacha\n\n## Formation\n\n- Master 2 droit public\n',
    );
  });

  test('creates a file of the Profile, edits it, then deletes it', async ({ page }) => {
    await openFreshProfileOf(page, { id: 'noe', name: 'Noé' });

    const creation = page.getByRole('region', { name: 'Nouveau fichier' });
    await creation.getByRole('textbox', { name: 'Nom du fichier' }).fill('../facts.md');
    await creation.getByRole('button', { name: 'Créer le fichier' }).click();
    await expect(creation.getByRole('alert')).toContainText("« ../facts.md » n'est pas un nom de fichier du Profil");
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
      'facts.md',
      'Nouveau fichier',
      'Veilles',
      'Notifications',
    ]);
  });

  test('shows in facts.md what the form of the Facts saves, and in the form what facts.md says', async ({ page }) => {
    await openFreshProfileOf(page, { id: 'ines', name: 'Inès' });

    const factsMarkdown = page.getByRole('region', { name: 'facts.md' }).getByRole('textbox');
    const factsForm = page.getByRole('region', { name: 'Faits', exact: true });
    await factsForm.getByRole('textbox', { name: 'Identité' }).fill('Inès Morel');
    const experiences = factsForm.getByRole('group', { name: 'Expériences' });
    await experiences.getByRole('button', { name: 'Ajouter' }).click();
    await experiences.getByRole('textbox', { name: 'Entrée 1' }).fill('Juriste, Mairie de Lens, 2026');
    await factsForm.getByRole('button', { name: 'Enregistrer les Faits' }).click();

    await expect(factsMarkdown).toHaveValue(/## Identité\n\nInès Morel\n/);
    await expect(factsMarkdown).toHaveValue(/## Expériences\n\n- Juriste, Mairie de Lens, 2026\n/);
    await expect(factsMarkdown).toHaveValue(/## Mobilité\n/);

    const markdown = await factsMarkdown.inputValue();
    await factsMarkdown.fill(
      `${markdown.replace('Inès Morel', 'Inès Morel-Durand')}\n## Compétences\n\nDroit public\n`,
    );
    await page.getByRole('region', { name: 'facts.md' }).getByRole('button', { name: 'Enregistrer' }).click();

    await expect(factsForm.getByRole('textbox', { name: 'Identité' })).toHaveValue('Inès Morel-Durand');
    await expect(factsForm.getByRole('textbox', { name: 'Compétences' })).toHaveValue('Droit public');
    await expect(experiences.getByRole('textbox', { name: 'Entrée 1' })).toHaveValue('Juriste, Mairie de Lens, 2026');
  });

  test('keeps a dropped PDF as an Upload, refuses a file that is not one, then deletes it', async ({ page }) => {
    await openFreshProfileOf(page, { id: 'malo', name: 'Malo' });
    const uploads = page.getByRole('region', { name: 'Pièces' });
    await expect(uploads.getByText('Aucune Pièce pour l’instant.')).toBeVisible();
    // Disabled until React hydrates: a file chosen before would go nowhere
    await expect(uploads.getByLabel('Déposer une Pièce')).toBeEnabled();

    await uploads
      .getByLabel('Déposer une Pièce')
      .setInputFiles({ name: 'cv.md', mimeType: 'text/markdown', buffer: Buffer.from('# CV\n') });
    await expect(uploads.getByRole('alert')).toContainText("« cv.md » n'est pas un nom de Pièce");
    await uploads
      .getByLabel('Déposer une Pièce')
      .setInputFiles(path.join(import.meta.dirname, '../test/fixtures/profile/cv.pdf'));

    await expect(uploads.getByRole('listitem')).toHaveCount(1);
    await expect(uploads.getByRole('listitem')).toContainText('cv.pdf');
    await expect(uploads.getByRole('listitem')).toContainText('déposée le');
    await expect(uploads.getByRole('alert')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Faits',
      'Pièces',
      'cv.md',
      'facts.md',
      'Nouveau fichier',
      'Veilles',
      'Notifications',
    ]);
    await expect(uploads.getByRole('listitem')).toContainText('cv.pdf');

    await uploads.getByText('Supprimer cv.pdf…').click();
    await uploads.getByRole('button', { name: 'Supprimer définitivement cv.pdf' }).click();
    await expect(uploads.getByText('Aucune Pièce pour l’instant.')).toBeVisible();
  });

  test('converts a dropped Upload into cv.md, then says why it will not overwrite it and runs again', async ({
    page,
  }) => {
    await openFreshProfileOf(page, { id: 'rose', name: 'Rose' }, { hasCv: false });
    const uploads = page.getByRole('region', { name: 'Pièces' });
    await expect(uploads.getByLabel('Déposer une Pièce')).toBeEnabled();
    const cvPdfPath = path.join(import.meta.dirname, '../test/fixtures/profile/cv.pdf');

    await uploads.getByLabel('Déposer une Pièce').setInputFiles(cvPdfPath);

    const conversion = uploads.getByRole('form', { name: 'Conversion en Markdown de cv.pdf' });
    await expect(conversion.getByRole('status')).toHaveText('En cours');
    await expect(conversion.getByRole('status')).toHaveText('Prêt');
    const cv = page.getByRole('region', { name: 'cv.md' });
    await expect(cv.getByRole('textbox')).toHaveValue('# CV converti\n\n## Formation\n\n- Master 2 droit public\n');
    await cv.getByRole('textbox').fill('# CV de Rose\n\n## Formation\n\n- Master 2 droit public, Lille\n');
    await cv.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(cv.getByText('Modifications non enregistrées')).toBeHidden();

    // Dropped again, the CV would replace the corrected cv.md: the conversion refuses and says so
    await uploads.getByLabel('Déposer une Pièce').setInputFiles(cvPdfPath);
    await expect(conversion.getByRole('status')).toHaveText('En échec');
    await expect(conversion).toContainText("que le Profil a déjà : il n'est pas écrasé");
    await expect(cv.getByRole('textbox')).toHaveValue(
      '# CV de Rose\n\n## Formation\n\n- Master 2 droit public, Lille\n',
    );

    await cv.getByText('Supprimer cv.md…').click();
    await cv.getByRole('button', { name: 'Supprimer définitivement cv.md' }).click();
    await expect(cv).toHaveCount(0);
    await conversion.getByRole('button', { name: 'Relancer la conversion de cv.pdf' }).click();
    await expect(conversion.getByRole('status')).toHaveText('Prêt');
    await expect(cv.getByRole('textbox')).toHaveValue('# CV converti\n\n## Formation\n\n- Master 2 droit public\n');
  });

  test('says how to fill an empty Profile', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Camille');
    await page.getByRole('button', { name: 'Choisir' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Camille');

    await page.getByRole('link', { name: 'Profil', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil de Camille');
    await expect(page.getByRole('code')).toHaveText('jf profile camille');
    await expect(page.getByRole('region', { name: /\.md$/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Nouveau fichier' })).toBeVisible();
  });
});
