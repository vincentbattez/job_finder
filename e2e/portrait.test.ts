import { expect, test } from '@playwright/test';

import { generate } from './generation.ts';
import { findInterviews, prepareInterview } from './interview.ts';

// A Posting that test/seed-front.ts leaves without any Artifact and that no other test touches: the test
// marks it Applied and gives it an Interview. The e2e worker runs the jobs with the fake Claude, whose
// sessions are short (test/e2e-actions.server.ts).
const REFERENCE = '2026-2410880';

// The worker takes the job, its session runs, and the Posting page reads the state again
const READY_TIMEOUT_MS = 15_000;

// The Portrait the fake Claude writes, corrected by the Candidate
const CORRECTED_PORTRAIT = '# Portrait factice\n\nMme Durand, juge des enfants à Paris depuis 2021.\n';

test('launches the Portrait of an Interview without a Research, then corrects it', async ({ page }) => {
  await prepareInterview(page, REFERENCE);
  const interviews = findInterviews(page);
  // The second tab of the selected Interview, kept in the URL
  await interviews.getByRole('tab', { name: /^Portrait/ }).click();
  await expect(page).toHaveURL(/&doc=portrait$/);
  const portrait = interviews.getByRole('region', { name: 'Portrait' });

  await generate(page, portrait);

  // A Draft until the Candidate validates it (ADR-0019)
  await expect(portrait.getByRole('combobox', { name: 'Version' })).toHaveText('Version 1 · Brouillon', {
    timeout: READY_TIMEOUT_MS,
  });
  await portrait.getByRole('button', { name: 'Valider la Version 1' }).click();
  await expect(portrait.getByText('Validée · retenue')).toBeVisible();
  await expect(interviews.getByRole('tab', { name: 'Portrait (Validée)' })).toBeVisible();
  // By the keyboard: the toast of the validation covers this button until it leaves
  await portrait.getByRole('button', { name: 'Modifier' }).press('Enter');
  const textbox = portrait.getByRole('textbox', { name: 'Texte de la Version 1' });
  await expect(textbox).toBeEnabled();
  await textbox.fill(CORRECTED_PORTRAIT);
  await portrait.getByRole('button', { name: 'Enregistrer' }).click();
  // Saved, the view goes back to reading
  await expect(textbox).toBeHidden();
  await page.reload();
  await expect(portrait.getByText('Mme Durand, juge des enfants à Paris depuis 2021.')).toBeVisible();
});
