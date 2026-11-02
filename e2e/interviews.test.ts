import { readFileSync } from 'node:fs';

import { expect, test } from './candidate.ts';
import { findInterviews, prepareApplication } from './interview.ts';

// An Application test/seed-front.ts marks Applied, whose Interviews only this test changes
const REFERENCE = '2026-2448213';

test('adds an Interview from the header, offers its iCal file, lands on it, then edits and deletes it', async ({
  page,
  openPage,
}) => {
  await prepareApplication(page, REFERENCE);
  // Added from the Posting tab, it lands on the Interviews tab all the same
  await openPage(`/postings/${REFERENCE}`);
  await page.locator('main > header').getByRole('button', { name: 'Ajouter un Entretien' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un Entretien' });
  // The place starts on the place of work of the Posting, and the duration on an hour
  await expect(dialog.getByRole('textbox', { name: 'Lieu' })).toHaveValue(/Caen/);
  await expect(dialog.getByRole('spinbutton', { name: 'Durée (min)' })).toHaveValue('60');
  await dialog.getByLabel('Jour').fill('2099-11-19');
  await dialog.getByLabel('Heure (Paris)').fill('14:00');
  await dialog.getByRole('textbox', { name: 'Interlocuteurs' }).fill('Mme Durand, directrice de greffe');
  await dialog.getByRole('button', { name: 'Ajouter l’Entretien' }).click();

  // The Interview-added step offers the iCal file first
  const added = page.getByRole('dialog', { name: 'Entretien ajouté' });
  await expect(added).toContainText('Mme Durand, directrice de greffe');
  await expect(page.getByText('Entretien 1 ajouté')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await added.getByRole('link', { name: 'Télécharger le fichier iCal (.ics)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`interview-${REFERENCE}-1.ics`);
  const ical = readFileSync(await download.path(), 'utf8').replaceAll('\r\n ', '');
  expect(ical).toContain('DTSTART;TZID=Europe/Paris:20991119T140000\r\n');
  expect(ical).toContain('Interlocuteurs : Mme Durand\\, directrice de greffe');
  expect(ical).toContain(`Page Job Finder : ${new URL(page.url()).origin}/postings/${REFERENCE}`);
  expect(ical.match(/TRIGGER:.*\r\n/g)).toEqual(['TRIGGER:-P1D\r\n', 'TRIGGER:-PT1H\r\n']);

  await added.getByRole('button', { name: 'Voir l’Entretien' }).click();
  await expect(page).toHaveURL(/\?tab=interviews&interview=1$/);
  const interviews = findInterviews(page);
  await expect(interviews.getByRole('heading', { level: 2, name: /19 novembre 2099/ })).toHaveText(
    'jeudi 19 novembre 2099 à 14:00',
  );
  await expect(page.locator('main > header [data-step]')).toHaveText('Convoquée');

  // Edited in the same Dialog
  await interviews.getByRole('button', { name: 'Modifier l’Entretien 1' }).click();
  const edit = page.getByRole('dialog', { name: 'Modifier l’Entretien 1' });
  await expect(edit.getByLabel('Heure (Paris)')).toHaveValue('14:00');
  await edit.getByRole('textbox', { name: 'Lieu' }).fill('En visioconférence');
  await edit.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Entretien 1 enregistré')).toBeVisible();
  await expect(edit).toBeHidden();
  await expect(interviews.getByRole('definition')).toContainText(['En visioconférence']);

  // Its Interview Brief and its Portrait, each a tab the URL keeps
  await expect(interviews.getByRole('tab', { name: /^Fiche d’entretien/ })).toHaveAttribute('aria-selected', 'true');
  await expect(interviews.getByRole('region', { name: 'Fiche d’entretien' })).toBeVisible();
  await interviews.getByRole('tab', { name: /^Portrait/ }).click();
  await expect(page).toHaveURL(/\?tab=interviews&interview=1&doc=portrait$/);
  await expect(interviews.getByRole('region', { name: 'Portrait' })).toBeVisible();

  // Deleted after confirming
  await interviews.getByRole('button', { name: 'Supprimer l’Entretien 1' }).click();
  await page
    .getByRole('alertdialog', { name: 'Supprimer l’Entretien 1 ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(page.getByText('Entretien 1 supprimé')).toBeVisible();
  await expect(interviews).toContainText('Aucun Entretien pour l’instant');
  await expect(page.locator('main > header [data-step]')).toHaveText('Postulée');
});

test('asks to mark a To Apply Posting Applied before adding an Interview', async ({ page }) => {
  await page.goto('/postings/2026-2445600?tab=interviews');

  await expect(findInterviews(page)).toContainText('marque l’Offre Postulée pour en ajouter un');
  await expect(findInterviews(page).getByRole('button', { name: 'Ajouter un Entretien' })).toHaveCount(0);
});
