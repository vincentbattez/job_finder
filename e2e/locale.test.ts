import { expect, test } from '@playwright/test';

// Emma reads the interface in English (test/seed-front.ts): her one Posting, imported, has no
// Deadline
test('shows the Posting list in English to a Candidate with the en locale', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Emma');
  await page.getByRole('button', { name: 'Choisir' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emma’s Postings');
  await expect(page).toHaveTitle('Postings · Job Finder');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('columnheader')).toHaveText(['Posting', 'Status', 'Published', 'Deadline']);
  const row = page.getByRole('row', { name: /court-clerk-lille\.md/ });
  await expect(row.getByRole('cell')).toHaveText([
    /^court-clerk-lille\.md/,
    'To Apply',
    // Imported on the day of the seed, as en-US writes it, as Oct 30, 2026
    /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/,
    'Not specified',
  ]);
});
