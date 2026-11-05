import { rmSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

import { expect, test } from './candidate.ts';
import { openGeneration } from './generation.ts';
import { findDataDirectory, openDatabase } from './harness.ts';

const ANNEX_FILE_NAME = 'annex-releve-de-notes.md';

// One of Cleo's Postings of test/seed-front.ts without any Custom Artifact, and her Profile without the
// Annex a test adds, whatever a previous run left; its reference comes back for the page
function resetCleo(fileName: string): string {
  const dataDirectory = findDataDirectory();
  rmSync(path.join(dataDirectory, 'candidates', 'cleo', 'profile', ANNEX_FILE_NAME), { force: true });
  const database = openDatabase();
  const { id, reference } = z
    .object({ id: z.number(), reference: z.string() })
    .parse(
      database
        .prepare('SELECT "id", "reference" FROM "Posting" WHERE "candidateId" = \'cleo\' AND "title" = ?')
        .get(fileName),
    );
  database.exec('BEGIN IMMEDIATE');
  database
    .prepare(
      'DELETE FROM "Version" WHERE "customArtifactId" IN (SELECT "id" FROM "CustomArtifact" WHERE "postingId" = ?)',
    )
    .run(id);
  database.prepare('DELETE FROM "CustomArtifact" WHERE "postingId" = ?').run(id);
  database.exec('COMMIT');
  database.close();
  return reference;
}

test('adds a document to the Posting from its Documents section, and an Annex to the Profile', async ({
  page,
  asCandidate,
  openPage,
}) => {
  const reference = resetCleo('greffier-cleo-douai.md');
  await asCandidate('cleo');
  await openPage(`/postings/${reference}`);
  const documents = page.getByRole('region', { name: 'Documents' });
  await expect(documents).toContainText('Aucun document.');

  await documents.getByRole('button', { name: 'Ajouter un document' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un document' });
  await dialog.getByLabel('Titre').fill('Appel avec la greffière');
  await dialog.getByLabel('Texte').fill('## Ce qu’elle attend\n\nUne personne rigoureuse.');
  await expect(dialog.getByRole('radio', { name: /^Pour cette Offre/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  const toasts = page.getByRole('region', { name: 'Notifications alt+T' });
  await expect(toasts).toContainText('Document ajouté : Appel avec la greffière');
  await expect(dialog).toBeHidden();
  await documents.getByRole('button', { name: 'Lire Appel avec la greffière' }).click();
  const reader = page.getByRole('dialog', { name: 'Appel avec la greffière' });
  await expect(reader).toContainText(/Document de l’Offre · validé/);
  await expect(reader.getByRole('heading', { name: 'Ce qu’elle attend' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Into the Profile instead: an Annex, not a document of the Posting
  await documents.getByRole('button', { name: 'Ajouter un document' }).click();
  await dialog.getByLabel('Titre').fill('Relevé de notes');
  await dialog.getByLabel('Texte').fill('Master 2 : mention bien.');
  await dialog.getByRole('radio', { name: /^Dans mon Profil \(Annexe\)/ }).check();
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect(toasts).toContainText('Annexe ajoutée à ton Profil : Relevé de notes');
  await expect(documents.getByRole('listitem')).toHaveCount(1);
});

test('adds a text from the generation panel, checked at once for this run', async ({ page, asCandidate, openPage }) => {
  const reference = resetCleo('greffier-cleo-laval.md');
  await asCandidate('cleo');
  await openPage(`/postings/${reference}?tab=research`);
  const panel = await openGeneration(page, page.getByRole('region', { name: 'Recherche' }));

  await panel.getByRole('button', { name: 'Ajouter un texte ou un fichier' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un texte ou un fichier' });
  // The Research does not read the Profile: an Annex would not be read
  await expect(dialog.getByRole('radio', { name: /^Dans mon Profil \(Annexe\)/ })).toBeDisabled();
  await dialog.getByLabel('Titre').fill('Organigramme du greffe');
  await dialog.getByLabel('Texte').fill('Le greffe compte douze agents.');
  await dialog.getByRole('button', { name: 'Ajouter et cocher' }).click();

  await expect(dialog).toBeHidden();
  await expect(panel.getByRole('checkbox', { name: 'Document · Organigramme du greffe' })).toBeChecked();
});
