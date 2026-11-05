import { expect, test, type Page } from '@playwright/test';

import { generate } from './generation.ts';
import { findInterviews, forgetResearch, prepareInterview, runVersion } from './interview.ts';
import { findOverflowing } from './overflow.ts';

// A Posting that test/seed-front.ts leaves without any Artifact and that no other test touches: the
// test marks it Applied, gives it an Interview and produces its Research first. The e2e worker runs
// the jobs with the fake Claude (test/e2e-actions.server.ts).
const REFERENCE = '2026-2416437';

// The worker takes the job, its session runs, and the Posting page reads the state again
const READY_TIMEOUT_MS = 15_000;

// The Interview Brief the fake Claude writes, its « [à compléter : …] » filled in by the Candidate
const CORRECTED_BRIEF = `# Fiche d’entretien factice

## Présentez-vous

Titulaire d’un master 2 de droit privé, je souhaite rejoindre votre juridiction.
`;

// Each test prepares its own start, on the one Posting of this file: one after the other
test.describe.configure({ mode: 'serial' });

test('refuses the Interview Brief of an Interview until the Posting has a Chosen Research', async ({ page }) => {
  forgetResearch(REFERENCE);
  await prepareInterview(page, REFERENCE);
  const research = page.getByRole('region', { name: 'Recherche' });
  // The first tab of the selected Interview
  const brief = findInterviews(page).getByRole('region', { name: 'Fiche d’entretien' });
  await expect(brief).toContainText(`L'Offre ${REFERENCE} n'a pas de Recherche validée`);
  await page.getByRole('tab', { name: /^Recherche/ }).click();
  await generate(page, research);
  await expect(research.getByRole('combobox', { name: 'Version' })).toHaveText('Version 1 · Brouillon', {
    timeout: READY_TIMEOUT_MS,
  });
  // Only a Validated Research is read by the Interview Brief
  await research.getByRole('button', { name: 'Valider la Version 1' }).click();
  await expect(page.getByRole('tab', { name: 'Recherche (Validée)' })).toBeVisible();
  await page.getByRole('tab', { name: /^Entretiens/ }).click();
  await expect(brief).toBeVisible();
  await expect(brief).not.toContainText("n'a pas de Recherche validée");
});

// An Interview whose Interview Brief can run, on a page reloaded once they are produced
async function prepareBriefOf(page: Page): Promise<void> {
  forgetResearch(REFERENCE);
  await prepareInterview(page, REFERENCE);
  await runVersion(page, { module: 'research', reference: REFERENCE, readyCount: 1 });
  await validate(page, 'research', { number: '1' });
}

async function validate(page: Page, artifact: string, form: Record<string, string>): Promise<void> {
  const response = await page.request.post(`/postings/${REFERENCE}/${artifact}/validate`, { form });
  expect(response.ok()).toBe(true);
}

async function reload(page: Page): Promise<void> {
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('launches the Interview Brief of an Interview, then validates it', async ({ page }) => {
  await prepareBriefOf(page);
  await reload(page);
  const brief = findInterviews(page).getByRole('region', { name: 'Fiche d’entretien' });

  await generate(page, brief);

  await expect(brief.getByRole('combobox', { name: 'Version' })).toHaveText('Version 1 · Brouillon', {
    timeout: READY_TIMEOUT_MS,
  });
  await expect(findInterviews(page).getByRole('tab', { name: 'Fiche d’entretien (Brouillon)' })).toBeVisible();
  await brief.getByRole('button', { name: 'Valider la Version 1' }).click();
  await expect(brief.getByText('Validée · retenue')).toBeVisible();
  await expect(findInterviews(page).getByRole('tab', { name: 'Fiche d’entretien (Validée)' })).toBeVisible();
});

test('corrects the Validated Interview Brief, which still fits a phone', async ({ page }) => {
  await prepareBriefOf(page);
  await runVersion(page, { module: 'interview_brief', reference: REFERENCE, interview: '1', readyCount: 1 });
  await validate(page, 'interview_brief', { number: '1', interview: '1' });
  await reload(page);
  const brief = findInterviews(page).getByRole('region', { name: 'Fiche d’entretien' });
  await brief.getByRole('button', { name: 'Modifier' }).click();
  const textbox = brief.getByRole('textbox', { name: 'Texte de la Version 1' });
  await expect(textbox).toBeEnabled();
  await textbox.fill(CORRECTED_BRIEF);
  await brief.getByRole('button', { name: 'Enregistrer' }).click();
  // Saved, the view goes back to reading
  await expect(textbox).toBeHidden();
  await page.reload();
  await expect(brief.getByRole('heading', { name: 'Présentez-vous' })).toBeVisible();
  await expect(brief.getByText('Validée · retenue')).toBeVisible();
  // Beside its Interview, the Interview Brief still fits a phone screen
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => findOverflowing(page)).toEqual([]);
});
