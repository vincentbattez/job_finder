import { expect, type Locator, type Page } from '@playwright/test';

export function findInterviews(page: Page): Locator {
  return page.getByRole('region', { name: 'Entretiens' });
}

// Each test starts from an Application without any Interview, whatever a previous run left: deleting an
// Interview deletes its Interview Brief too
export async function deleteEveryInterview(page: Page): Promise<void> {
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

// The Posting page open, the Posting Applied if it was not yet, with a single Interview, freshly added:
// what an Interview Brief prepares. Gives the article of that Interview.
export async function prepareInterview(page: Page, reference: string): Promise<Locator> {
  await page.goto(`/postings/${reference}?tab=interviews`);
  // A form typed in before React runs the page would be reset: wait for it
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', { timeout: 15_000 });
  const markApplied = page.getByRole('button', { name: 'Marquer Postulée' });
  if ((await markApplied.count()) > 0) {
    await markApplied.click();
    await expect(markApplied).toHaveCount(0);
  }
  await deleteEveryInterview(page);
  const newInterview = findInterviews(page).getByRole('group', { name: 'Nouvel Entretien' });
  await newInterview.getByLabel('Début').fill('2099-11-19T14:00');
  await newInterview.getByRole('textbox', { name: 'Interlocuteurs' }).fill('Mme Durand, juge des enfants');
  await newInterview.getByRole('button', { name: 'Ajouter l’Entretien' }).click();
  const interview = findInterviews(page).getByRole('article', { name: 'Entretien 1' });
  await expect(interview).toBeVisible();
  return interview;
}
