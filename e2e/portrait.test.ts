import { expect, test } from '@playwright/test';

import { prepareInterview } from './interview.ts';
import { unfoldLatestVersion } from './version.ts';

// A Posting that test/seed-front.ts leaves without any Artifact and that no other test touches: the test
// marks it Applied and gives it an Interview. The e2e worker runs the jobs with the fake Claude, whose
// sessions last a second (test/e2e-actions.server.ts).
const REFERENCE = '2026-2410880';

// The worker takes the job, then its session lasts a second, and the Posting page reads the state again
// every two seconds
const READY_TIMEOUT_MS = 15_000;

// The Portrait the fake Claude writes, corrected by the Candidate
const CORRECTED_PORTRAIT = '# Portrait factice\n\nMme Durand, juge des enfants à Paris depuis 2021.\n';

test('launches the Portrait of an Interview without a Research, then corrects it', async ({ page }) => {
  const interview = await prepareInterview(page, REFERENCE);
  // Under its Interview, before its Interview Brief
  const portrait = interview.getByRole('region', { name: 'Portrait' });
  await expect(interview.getByRole('region')).toHaveText([/^Portrait/, /^Fiche d’entretien/]);

  await portrait.getByRole('button', { name: 'Lancer le Portrait' }).click();

  await expect(portrait.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
  // A Draft until the Candidate validates it (ADR-0019)
  await expect(portrait.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Brouillon/]);
  await unfoldLatestVersion(portrait);
  await portrait.getByRole('button', { name: 'Valider la Version 1' }).click();
  await expect(portrait.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Validée · retenue/]);
  await expect(portrait.getByText(`jf edit ${REFERENCE} portrait 1`)).toBeVisible();
  const document = portrait.getByRole('figure', { name: 'portrait.md' });
  const editor = document.getByRole('textbox', { name: 'Markdown' });
  await expect(editor).toBeEnabled();
  await editor.fill(CORRECTED_PORTRAIT);
  await document.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(document.getByText('Modifications non enregistrées')).toBeHidden();
  await page.reload();
  await unfoldLatestVersion(portrait);
  await expect(editor).toHaveValue(CORRECTED_PORTRAIT);
});
