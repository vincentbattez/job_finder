import { readFileSync } from 'node:fs';

import { expect, test } from './candidate.ts';
import { deleteEveryInterview, findInterviews } from './interview.ts';

// An Application test/seed-front.ts marks Applied, whose Interviews only this test changes
const REFERENCE = '2026-2448213';

test('adds an Interview to an Application, which becomes Invited, then edits and deletes it', async ({
  page,
  openPage,
}) => {
  // A form typed in before React runs the page would be reset: openPage waits for it
  await openPage(`/postings/${REFERENCE}?tab=interviews`);
  await deleteEveryInterview(page);
  const interviews = findInterviews(page);
  const newInterview = interviews.getByRole('group', { name: 'Nouvel Entretien' });
  // The place starts on the place of work of the Posting, and the duration on an hour
  await expect(newInterview.getByRole('textbox', { name: 'Lieu' })).toHaveValue(/Caen/);
  await expect(newInterview.getByRole('spinbutton', { name: 'Durée (minutes)' })).toHaveValue('60');

  await newInterview.getByLabel('Début').fill('2099-11-19T14:00');
  await newInterview.getByRole('textbox', { name: 'Interlocuteurs' }).fill('Mme Durand, directrice de greffe');
  await newInterview.getByRole('button', { name: 'Ajouter l’Entretien' }).click();

  const interview = interviews.getByRole('article', { name: 'Entretien 1' });
  await expect(interview).toContainText('19 nov. 2099, 14:00');
  await expect(interview).toContainText('Mme Durand, directrice de greffe');
  await expect(page.locator('main > header [data-step]')).toHaveText('Convoquée');

  // The iCal file, its links on the address the page was opened through
  const icalLink = interview.getByRole('link', { name: 'Ajouter à l’agenda (iCal)' });
  const downloadPromise = page.waitForEvent('download');
  await icalLink.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`interview-${REFERENCE}-1.ics`);
  const ical = readFileSync(await download.path(), 'utf8').replaceAll('\r\n ', '');
  expect(ical).toContain('DTSTART;TZID=Europe/Paris:20991119T140000\r\n');
  expect(ical).toContain(`Page Job Finder : ${new URL(page.url()).origin}/postings/${REFERENCE}`);
  const response = await page.request.get(String(await icalLink.getAttribute('href')));
  expect(response.headers()['content-type']).toBe('text/calendar; charset=utf-8');

  await interview.getByText('Modifier l’Entretien 1').click();
  await interview.getByRole('textbox', { name: 'Lieu' }).fill('En visioconférence');
  await interview.getByRole('button', { name: 'Enregistrer l’Entretien' }).click();
  await expect(interview.getByRole('definition')).toContainText(['En visioconférence']);

  await interview.getByText('Supprimer l’Entretien 1…').click();
  await interview.getByRole('button', { name: 'Supprimer définitivement l’Entretien 1' }).click();
  await expect(interviews.getByRole('article')).toHaveCount(0);
  await expect(interviews).toContainText('Aucun Entretien pour l’instant.');
  await expect(page.locator('main > header [data-step]')).toHaveText('Postulée');
});

test('asks to mark a To Apply Posting Applied before adding an Interview', async ({ page }) => {
  await page.goto('/postings/2026-2445600?tab=interviews');

  await expect(findInterviews(page)).toContainText('marquer l’Offre Postulée pour en ajouter un');
  await expect(findInterviews(page).getByRole('button', { name: 'Ajouter l’Entretien' })).toHaveCount(0);
});
