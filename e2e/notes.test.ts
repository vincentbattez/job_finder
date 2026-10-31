import { expect, test } from '@playwright/test';

// Postings that no other journey changes, one per test since they run in parallel
const REFERENCE = '2026-2199164';
const NO_JS_REFERENCE = '2026-2445637';

const NOTES = '# Appel du greffe\n\nRappeler **lundi** la greffière en chef.\n';

test('keeps Notes on a To Apply Posting and finds them after a reload', async ({ page }) => {
  await page.goto(`/postings/${REFERENCE}`);
  const notes = page.getByRole('region', { name: 'Notes' });
  const editor = notes.getByRole('textbox', { name: 'Notes en Markdown' });
  // The editor takes text once React runs the page, which would reset a field typed before
  await expect(editor).toBeEditable();

  await editor.fill(NOTES);
  await expect(notes.getByText('Modifications non enregistrées')).toBeVisible();
  await notes.getByRole('button', { name: 'Enregistrer les Notes' }).click();
  await expect(notes.getByText('Modifications non enregistrées')).toBeHidden();
  await page.reload();

  await expect(editor).toHaveValue(NOTES);
  await expect(notes.getByRole('heading', { name: 'Appel du greffe' })).toBeVisible();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  // The form posts on its own and the action route brings the Candidate back to the Posting page
  test('shows the Notes section and saves it through a plain form post', async ({ page }) => {
    await page.goto(`/postings/${NO_JS_REFERENCE}`);
    const notes = page.getByRole('region', { name: 'Notes' });

    await notes.getByRole('button', { name: 'Enregistrer les Notes' }).click();

    await expect(page).toHaveURL(new RegExp(`/postings/${NO_JS_REFERENCE}$`));
    await expect(page.getByRole('region', { name: 'Notes' })).toBeVisible();
  });
});
