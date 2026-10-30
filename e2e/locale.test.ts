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

test('shows the tools of the Posting list in English to a Candidate with the en locale', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Emma');
  await page.getByRole('button', { name: 'Choisir' }).click();

  await expect(page.getByRole('button', { name: 'Run a Detection' })).toBeVisible();
  await expect(page.getByText('Import a Job Description')).toBeVisible();
  const filters = page.getByRole('search', { name: 'Filters' });
  await expect(filters.getByRole('combobox', { name: 'City' })).toBeVisible();
  await expect(filters.getByRole('combobox', { name: 'Region' })).toBeVisible();
  await expect(filters.getByRole('checkbox', { name: 'Show the Archived' })).toBeVisible();
  await expect(filters.getByRole('button', { name: 'Filter' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Map of the Postings' })).toContainText(
    '1 Posting without coordinates is not on the map.',
  );
});

// Oliver reads the interface in English too, and owns the one Posting this test changes
// (test/seed-front.ts): imported, its fields unread, with a Research. Archived and put back To
// Apply, it ends as it started; Applied, which is never undone, is only asked, then cancelled.
test('takes a Candidate with the en locale through a Posting and its Status in English', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Oliver');
  await page.getByRole('button', { name: 'Choisir' }).click();
  await page.getByRole('checkbox', { name: 'Show the Archived' }).check();
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByRole('link', { name: 'registry-officer-douai.md' }).click();
  const statusBadge = page.locator('.posting-detail__title .badge');
  const backToApply = page.getByRole('button', { name: 'Back to To Apply' });
  // Left Archived by a run stopped halfway
  if (await backToApply.isVisible()) {
    await backToApply.click();
  }
  await expect(statusBadge).toHaveText('To Apply');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('registry-officer-douai.md');
  await expect(page).toHaveTitle('registry-officer-douai.md · Job Finder');
  await expect(page.getByRole('term')).toHaveText([
    'Reference',
    'Published',
    'Deadline',
    'Application email',
    'Contact 1',
    'Contact 2',
  ]);
  const extraction = page.getByRole('form', { name: 'Fields read by Claude' });
  await expect(extraction.getByRole('status')).toHaveText('Failed');
  await expect(extraction.getByRole('button', { name: 'Run the extraction again' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Artifacts' }).getByRole('listitem')).toHaveText([
    'ResearchReady',
    'LetterAbsent',
    'Interview BriefAbsent',
    'VisualizationAbsent',
  ]);
  await expect(page.getByRole('region', { name: 'Contacts' }).getByRole('definition')).toHaveText([
    'Not specified',
    'Not specified',
    'Not specified',
  ]);
  await expect(page.getByRole('region', { name: 'Recommended recipients' })).toContainText(
    'The Letter recommends them, once written.',
  );
  await expect(page.getByText('Read the Job Description')).toBeVisible();
  const research = page.getByRole('region', { name: 'Research', exact: true });
  await expect(research.getByRole('button', { name: 'Run the Research again' })).toBeVisible();
  await expect(research.getByText('Default Instructions')).toBeVisible();
  await expect(research.getByText('Chosen', { exact: true })).toBeVisible();
  await expect(research.getByText('Instructions of this Version')).toBeVisible();
  await expect(research.getByText('Preview')).toBeVisible();
  await expect(research.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(research.getByRole('button', { name: 'Copy the Markdown' })).toBeVisible();
  const letter = page.getByRole('region', { name: 'Letter', exact: true });
  await expect(letter.getByRole('button', { name: 'Run the Letter' })).toBeVisible();
  await expect(letter.getByText('No Version yet.')).toBeVisible();

  await expect(page.getByText('Once Applied, the Chosen Letter no longer changes: it is the one sent.')).toBeVisible();
  await page.getByRole('button', { name: 'Mark as Applied' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(statusBadge).toHaveText('Archived');
  await backToApply.click();
  await expect(statusBadge).toHaveText('To Apply');
});
