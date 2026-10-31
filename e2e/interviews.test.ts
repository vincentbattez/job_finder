import { expect, test, type Locator, type Page } from '@playwright/test';

// Applications test/seed-front.ts marks Applied, whose Interviews only these tests change: one with JS,
// one without
const REFERENCE = '2026-2448213';
const NO_JS_REFERENCE = '2026-2448215';

function findInterviews(page: Page): Locator {
  return page.getByRole('region', { name: 'Entretiens' });
}

// Each test starts from an Application without any Interview, whatever a previous run left
async function deleteEveryInterview(page: Page): Promise<void> {
  const interviews = findInterviews(page);
  const interviewList = interviews.getByRole('article');
  while ((await interviewList.count()) > 0) {
    const count = await interviewList.count();
    const first = interviewList.first();
    await first.getByText(/^Supprimer l’Entretien \d+…$/).click();
    await first.getByRole('button', { name: /^Supprimer définitivement/ }).click();
    await expect(interviewList).toHaveCount(count - 1);
  }
}

test('adds an Interview to an Application, which becomes Invited, then edits and deletes it', async ({ page }) => {
  await page.goto(`/postings/${REFERENCE}`);
  // A form typed in before React runs the page would be reset: the Research button waits for it
  await expect(page.getByRole('button', { name: 'Lancer la Recherche' })).toBeEnabled();
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
  await expect(page.locator('.badge[data-status]').first()).toHaveText('Convoquée');

  await interview.getByText('Modifier l’Entretien 1').click();
  await interview.getByRole('textbox', { name: 'Lieu' }).fill('En visioconférence');
  await interview.getByRole('button', { name: 'Enregistrer l’Entretien' }).click();
  await expect(interview.getByRole('definition')).toContainText(['En visioconférence']);

  await interview.getByText('Supprimer l’Entretien 1…').click();
  await interview.getByRole('button', { name: 'Supprimer définitivement l’Entretien 1' }).click();
  await expect(interviews.getByRole('article')).toHaveCount(0);
  await expect(interviews).toContainText('Aucun Entretien pour l’instant.');
  await expect(page.locator('.badge[data-status]').first()).toHaveText('Postulée');
});

test('asks to mark a To Apply Posting Applied before adding an Interview', async ({ page }) => {
  await page.goto('/postings/2026-2445600');

  await expect(findInterviews(page)).toContainText('marquer l’Offre Postulée pour en ajouter un');
  await expect(findInterviews(page).getByRole('button', { name: 'Ajouter l’Entretien' })).toHaveCount(0);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  // The forms post on their own and the action route brings the Candidate back to the Posting page
  test('adds and deletes an Interview through plain form posts', async ({ page }) => {
    await page.goto(`/postings/${NO_JS_REFERENCE}`);
    await deleteEveryInterview(page);
    const newInterview = findInterviews(page).getByRole('group', { name: 'Nouvel Entretien' });

    await newInterview.getByLabel('Début').fill('2099-12-01T09:30');
    await newInterview.getByRole('button', { name: 'Ajouter l’Entretien' }).click();

    await expect(page).toHaveURL(new RegExp(`/postings/${NO_JS_REFERENCE}$`));
    await expect(findInterviews(page).getByRole('article', { name: 'Entretien 1' })).toContainText(
      '1 déc. 2099, 09:30',
    );
    await deleteEveryInterview(page);
  });
});
