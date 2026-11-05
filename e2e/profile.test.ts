import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';
import { z } from 'zod/v4';

import { expect, test, type AsCandidate, type IFront } from './candidate.ts';

const HEADING_LIST = ['CV', 'Faits', 'Lettres de motivation passées', 'Annexes', 'Pièces', 'Nouveau fichier'] as const;

function toastsOf(page: Page) {
  return page.getByRole('region', { name: 'Notifications alt+T' });
}

// A document of the Profile: its row, whose editor is folded until asked
function documentOf(page: Page, fileName: string) {
  return page.getByRole('listitem').filter({ has: page.getByText(fileName, { exact: true }) });
}

function contentOf(page: Page, fileName: string) {
  return documentOf(page, fileName).getByRole('textbox', { name: `Contenu de ${fileName}` });
}

async function unfold(page: Page, fileName: string) {
  await documentOf(page, fileName)
    .getByRole('button', { name: `Modifier ${fileName}` })
    .click();
  await expect(contentOf(page, fileName)).toBeVisible();
}

async function deleteThroughDialog(page: Page, fileName: string) {
  await page.getByRole('button', { name: `Supprimer ${fileName}` }).click();
  const dialog = page.getByRole('alertdialog', { name: `Supprimer ${fileName} ?` });
  await dialog.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(toastsOf(page).getByText(`${fileName} supprim`)).toBeVisible();
}

// Each test changes the Profile of a Candidate of its own (test/seed-front.ts), which it puts back
// first, as jf profile would have written it: a test that failed halfway leaves nothing behind
async function openFreshProfileOf(
  { page, asCandidate, openPage }: Readonly<IFront & { asCandidate: AsCandidate }>,
  { id, name }: Readonly<{ id: string; name: string }>,
  { hasCv = true }: Readonly<{ hasCv?: boolean }> = {},
) {
  const { dataDirectory } = z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata);
  const candidateDirectory = path.join(dataDirectory, 'candidates', id);
  const profileDirectory = path.join(candidateDirectory, 'profile');
  rmSync(profileDirectory, { recursive: true, force: true });
  mkdirSync(profileDirectory, { recursive: true });
  if (hasCv) {
    writeFileSync(path.join(profileDirectory, 'cv.md'), `# CV de ${name}\n\n## Formation\n\n- Master 2 droit public\n`);
  }
  writeFileSync(path.join(profileDirectory, 'facts.md'), '# Faits\n\n## Mobilité\n\n- Lille et alentours\n');
  await asCandidate(id);
  await openPage('/profile');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Profil de ${name}`);
  // React resets a textarea when it takes over the page
  await expect(page.getByRole('button', { name: 'Enregistrer les Faits' })).toBeEnabled();
}

test.describe('Profile of a Candidate', () => {
  test('shows each document under its section and saves the one modified', async ({ page, asCandidate, openPage }) => {
    await openFreshProfileOf({ page, asCandidate, openPage }, { id: 'sacha', name: 'Sacha' });
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(HEADING_LIST);
    await expect(page.getByRole('region', { name: 'CV', exact: true }).getByRole('listitem')).toContainText('cv.md');
    await expect(page.getByRole('region', { name: 'Annexes' }).getByText('Pas encore d’Annexe.')).toBeVisible();

    await expect(contentOf(page, 'cv.md')).toBeHidden();
    await unfold(page, 'cv.md');
    await expect(contentOf(page, 'cv.md')).toHaveValue('# CV de Sacha\n\n## Formation\n\n- Master 2 droit public\n');
    await contentOf(page, 'cv.md').fill('# CV de Sacha\n\n## Formation\n\n- Master 2 droit public, Lille\n');
    await expect(documentOf(page, 'cv.md').getByText('Modifications non enregistrées')).toBeVisible();
    await documentOf(page, 'cv.md').getByRole('button', { name: 'Enregistrer cv.md' }).click();
    await expect(toastsOf(page).getByText('cv.md enregistré')).toBeVisible();
    await expect(documentOf(page, 'cv.md').getByText('Modifications non enregistrées')).toBeHidden();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Enregistrer les Faits' })).toBeEnabled();
    await unfold(page, 'cv.md');
    await expect(contentOf(page, 'cv.md')).toHaveValue(
      '# CV de Sacha\n\n## Formation\n\n- Master 2 droit public, Lille\n',
    );
  });

  test('creates a Past Letter under its own name, edits it, then deletes it through the dialog', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await openFreshProfileOf({ page, asCandidate, openPage }, { id: 'noe', name: 'Noé' });

    const creation = page.getByRole('region', { name: 'Nouveau fichier' });
    await creation.getByRole('button', { name: 'Créer un fichier' }).click();
    await creation.getByRole('textbox', { name: 'Nom du fichier' }).fill('../facts.md');
    await creation.getByRole('button', { name: 'Créer le fichier' }).click();
    await expect(toastsOf(page).getByText("« ../facts.md » n'est pas un nom de fichier du Profil")).toBeVisible();
    // A refusal keeps what was typed
    await expect(creation.getByRole('textbox', { name: 'Nom du fichier' })).toHaveValue('../facts.md');

    await creation.getByRole('textbox', { name: 'Nom du fichier' }).fill('letter-tj-lille-2025.md');
    await creation.getByRole('textbox', { name: /^Contenu/ }).fill('# Lettre au TJ de Lille\n');
    await creation.getByRole('button', { name: 'Créer le fichier' }).click();
    await expect(toastsOf(page).getByText('Fichier créé')).toBeVisible();

    const pastLetters = page.getByRole('region', { name: 'Lettres de motivation passées' });
    await expect(pastLetters.getByRole('listitem')).toContainText('letter-tj-lille-2025.md');
    await expect(creation.getByRole('textbox', { name: 'Nom du fichier' })).toHaveCount(0);

    await unfold(page, 'letter-tj-lille-2025.md');
    await contentOf(page, 'letter-tj-lille-2025.md').fill('# Lettre au TJ de Lille\n\nMadame la Présidente,\n');
    await page.getByRole('button', { name: 'Enregistrer letter-tj-lille-2025.md' }).click();
    await expect(toastsOf(page).getByText('letter-tj-lille-2025.md enregistré')).toBeVisible();

    await deleteThroughDialog(page, 'letter-tj-lille-2025.md');
    await expect(documentOf(page, 'letter-tj-lille-2025.md')).toHaveCount(0);
    await expect(pastLetters.getByText('Pas encore de Lettre de motivation passée')).toBeVisible();
  });

  test('keeps a document when its deletion is called off', async ({ page, asCandidate, openPage }) => {
    await openFreshProfileOf({ page, asCandidate, openPage }, { id: 'maya', name: 'Maya' });

    await page.getByRole('button', { name: 'Supprimer cv.md' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Le garder' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(documentOf(page, 'cv.md')).toBeVisible();
  });

  test('shows in facts.md what the form of the Facts saves, and in the form what facts.md says', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await openFreshProfileOf({ page, asCandidate, openPage }, { id: 'ines', name: 'Inès' });

    const factsForm = page.getByRole('region', { name: 'Faits', exact: true });
    await factsForm.getByRole('textbox', { name: 'Identité' }).fill('Inès Morel');
    const experiences = factsForm.getByRole('group', { name: 'Expériences' });
    await experiences.getByRole('button', { name: 'Ajouter' }).click();
    await experiences.getByRole('textbox', { name: 'Entrée 1' }).fill('Juriste, Mairie de Lens, 2026');
    await factsForm.getByRole('button', { name: 'Enregistrer les Faits' }).click();
    await expect(toastsOf(page).getByText('Faits enregistrés')).toBeVisible();

    await unfold(page, 'facts.md');
    const factsMarkdown = contentOf(page, 'facts.md');
    await expect(factsMarkdown).toHaveValue(/## Identité\n\nInès Morel\n/);
    await expect(factsMarkdown).toHaveValue(/## Expériences\n\n- Juriste, Mairie de Lens, 2026\n/);
    await expect(factsMarkdown).toHaveValue(/## Mobilité\n/);

    const markdown = await factsMarkdown.inputValue();
    await factsMarkdown.fill(
      `${markdown.replace('Inès Morel', 'Inès Morel-Durand')}\n## Compétences\n\nDroit public\n`,
    );
    await page.getByRole('button', { name: 'Enregistrer facts.md' }).click();

    await expect(factsForm.getByRole('textbox', { name: 'Identité' })).toHaveValue('Inès Morel-Durand');
    await expect(factsForm.getByRole('textbox', { name: 'Compétences' })).toHaveValue('Droit public');
    await expect(experiences.getByRole('textbox', { name: 'Entrée 1' })).toHaveValue('Juriste, Mairie de Lens, 2026');
  });

  test('writes an Annex, edits it, then deletes it through the dialog', async ({ page, asCandidate, openPage }) => {
    await openFreshProfileOf({ page, asCandidate, openPage }, { id: 'lucie', name: 'Lucie' });

    const annexes = page.getByRole('region', { name: 'Annexes' });
    await annexes.getByRole('button', { name: 'Écrire une Annexe' }).click();
    await annexes.getByRole('textbox', { name: 'Titre' }).fill('Relevé de notes');
    await annexes.getByRole('textbox', { name: 'Texte, en Markdown' }).fill('# Relevé\n\n- Droit public : 15/20\n');
    await annexes.getByRole('button', { name: 'Ajouter l’Annexe' }).click();
    await expect(toastsOf(page).getByText('Annexe ajoutée')).toBeVisible();

    const fileName = 'annex-releve-de-notes.md';
    await expect(annexes.getByRole('listitem')).toContainText(fileName);
    await unfold(page, fileName);
    await expect(contentOf(page, fileName)).toHaveValue('# Relevé\n\n- Droit public : 15/20\n');
    await contentOf(page, fileName).fill('# Relevé\n\n- Droit public : 16/20\n');
    await page.getByRole('button', { name: `Enregistrer ${fileName}` }).click();
    await expect(toastsOf(page).getByText(`${fileName} enregistré`)).toBeVisible();

    await deleteThroughDialog(page, fileName);
    await expect(annexes.getByText('Pas encore d’Annexe.')).toBeVisible();
    await page.reload();
    await expect(annexes.getByText('Pas encore d’Annexe.')).toBeVisible();
  });

  test('keeps a dropped PDF as an Upload, refuses a file that is not one, then deletes it', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    await openFreshProfileOf({ page, asCandidate, openPage }, { id: 'malo', name: 'Malo' });
    const uploads = page.getByRole('region', { name: 'Pièces' });
    await expect(uploads.getByText('Aucune Pièce pour l’instant.')).toBeVisible();
    // Disabled until React hydrates: a file chosen before would go nowhere
    await expect(uploads.getByLabel('Déposer une Pièce')).toBeEnabled();

    await uploads
      .getByLabel('Déposer une Pièce')
      .setInputFiles({ name: 'cv.md', mimeType: 'text/markdown', buffer: Buffer.from('# CV\n') });
    await expect(toastsOf(page).getByText("« cv.md » n'est pas un nom de Pièce")).toBeVisible();
    await uploads
      .getByLabel('Déposer une Pièce')
      .setInputFiles(path.join(import.meta.dirname, '../test/fixtures/profile/cv.pdf'));
    await expect(toastsOf(page).getByText('cv.pdf déposée')).toBeVisible();

    await expect(uploads.getByRole('listitem')).toHaveCount(1);
    await expect(uploads.getByRole('listitem')).toContainText('cv.pdf');
    await expect(uploads.getByRole('listitem')).toContainText('déposée le');
    await page.reload();
    await expect(uploads.getByRole('listitem')).toContainText('cv.pdf');

    await deleteThroughDialog(page, 'cv.pdf');
    await expect(uploads.getByText('Aucune Pièce pour l’instant.')).toBeVisible();
  });

  test.describe('the conversion of an Upload', () => {
    const cvPdfPath = path.join(import.meta.dirname, '../test/fixtures/profile/cv.pdf');
    // Each test puts back the Profile of Rose, their one Candidate: one after the other
    test.describe.configure({ mode: 'serial' });

    test('converts a dropped Upload into cv.md', async ({ page, asCandidate, openPage }) => {
      await openFreshProfileOf({ page, asCandidate, openPage }, { id: 'rose', name: 'Rose' }, { hasCv: false });
      const uploads = page.getByRole('region', { name: 'Pièces' });
      await expect(uploads.getByLabel('Déposer une Pièce')).toBeEnabled();

      await uploads.getByLabel('Déposer une Pièce').setInputFiles(cvPdfPath);

      const conversion = uploads.getByRole('form', { name: 'Conversion en Markdown de cv.pdf' });
      await expect(conversion.getByRole('status')).toHaveText('En cours');
      await expect(conversion.getByRole('status')).toHaveText('Prêt');
      await unfold(page, 'cv.md');
      await expect(contentOf(page, 'cv.md')).toHaveValue('# CV converti\n\n## Formation\n\n- Master 2 droit public\n');
    });

    test('says why it will not overwrite a cv.md, and runs again once it is gone', async ({
      page,
      asCandidate,
      openPage,
    }) => {
      await openFreshProfileOf({ page, asCandidate, openPage }, { id: 'rose', name: 'Rose' });
      const uploads = page.getByRole('region', { name: 'Pièces' });
      await expect(uploads.getByLabel('Déposer une Pièce')).toBeEnabled();

      await uploads.getByLabel('Déposer une Pièce').setInputFiles(cvPdfPath);

      const conversion = uploads.getByRole('form', { name: 'Conversion en Markdown de cv.pdf' });
      await expect(conversion.getByRole('status')).toHaveText('En échec');
      await expect(conversion).toContainText("que le Profil a déjà : il n'est pas écrasé");
      await unfold(page, 'cv.md');
      await expect(contentOf(page, 'cv.md')).toHaveValue('# CV de Rose\n\n## Formation\n\n- Master 2 droit public\n');

      await deleteThroughDialog(page, 'cv.md');
      // By the keyboard: the toast of the deletion covers this button until it leaves
      await conversion.getByRole('button', { name: 'Relancer la conversion de cv.pdf' }).press('Enter');
      await expect(toastsOf(page).getByText('Conversion de cv.pdf en file d’attente')).toBeVisible();
      await expect(conversion.getByRole('status')).toHaveText('Prêt');
      await unfold(page, 'cv.md');
      await expect(contentOf(page, 'cv.md')).toHaveValue('# CV converti\n\n## Formation\n\n- Master 2 droit public\n');
    });
  });

  test('says how to fill an empty Profile', async ({ page, asCandidate, openPage }) => {
    await asCandidate('camille');

    await openPage('/profile');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil de Camille');
    await expect(page.getByRole('code')).toHaveText('jf profile camille');
    await expect(page.getByRole('region', { name: 'CV', exact: true }).getByRole('listitem')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Nouveau fichier' })).toBeVisible();
  });
});
