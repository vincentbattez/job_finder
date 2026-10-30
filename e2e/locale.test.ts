import { expect, test, type Page } from '@playwright/test';

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

// Emma's pages are read, never changed: she is shared with the test above
async function chooseEmma(page: Page) {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Emma');
  await page.getByRole('button', { name: 'Choisir' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emma’s Postings');
}

test('shows the menu and the Profile in English to a Candidate with the en locale', async ({ page }) => {
  await chooseEmma(page);
  await expect(page.getByRole('combobox', { name: 'Candidate' })).toHaveValue('emma');
  await expect(page.getByRole('button', { name: 'Choose' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Pages' }).getByRole('link')).toHaveText([
    'Postings',
    'Profile',
    'Instructions',
    'Candidates',
  ]);

  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emma’s Profile');
  await expect(page).toHaveTitle('Profile · Job Finder');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Facts',
    'Uploads',
    'New file',
    'Watches',
    'Notifications',
  ]);
  await expect(page.getByText('No Upload yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save the Facts' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'New file' }).getByRole('textbox', { name: 'File name' }),
  ).toBeVisible();
  const newWatch = page.getByRole('group', { name: 'New Watch' });
  await expect(newWatch.getByRole('textbox', { name: 'Searched title' })).toBeVisible();
  await expect(newWatch.getByRole('textbox', { name: 'Courts of appeal of the Zone, one per line' })).toBeVisible();
  await expect(newWatch.getByRole('button', { name: 'Create the Watch' })).toBeVisible();
  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(notifications.getByRole('combobox', { name: 'Notification Channel' })).toHaveValue('home-assistant');
  await expect(notifications.getByRole('textbox', { name: 'Home Assistant address' })).toBeVisible();
  await expect(notifications.getByRole('button', { name: 'Send a test notification' })).toBeVisible();
});

test('shows the Instructions and the Candidates in English to a Candidate with the en locale', async ({ page }) => {
  await chooseEmma(page);

  await page.getByRole('link', { name: 'Instructions', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emma’s Instructions');
  await expect(page).toHaveTitle('Instructions · Job Finder');
  const letter = page.getByRole('region', { name: 'Letter' });
  await expect(letter.getByText('Default Instructions', { exact: true })).toBeVisible();
  // The default Instructions of her locale; the Letter itself is written in the Job Description's
  await expect(letter.getByRole('textbox')).toHaveValue(/^Write a one-page cover letter/);
  await expect(letter.getByRole('button', { name: 'Save my Instructions' })).toBeVisible();

  await page.getByRole('link', { name: 'Candidates', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Candidates');
  await expect(page).toHaveTitle('Candidates · Job Finder');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Rename a Candidate',
    'New Candidate',
    'Default Deadline Period',
  ]);
});

test('shows the design page in English to a Candidate with the en locale', async ({ page }) => {
  await chooseEmma(page);
  await page.goto('/design');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Design system');
  await expect(page).toHaveTitle('Job Finder design system');
});
