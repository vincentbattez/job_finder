import { expect, test, type IFront } from './candidate.ts';

// Emma reads the interface in English (test/seed-front.ts): her one Posting, imported, has no
// Deadline
test('shows the Posting list in English to a Candidate with the en locale', async ({ page, asCandidate, openPage }) => {
  await asCandidate('emma');
  await openPage('/postings');

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
// Her home, once asCandidate chose her
async function openHomeOfEmma({ page, openPage }: IFront) {
  await openPage('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New');
}

test('shows the Sidebar and the Profile in English to a Candidate with the en locale', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('emma');
  await openHomeOfEmma({ page, openPage });
  await expect(page.getByRole('button', { name: 'Switch Candidate' })).toContainText('Emma');
  await expect(page.getByRole('navigation', { name: 'Pages' }).getByRole('link')).toHaveText([
    'New',
    'To Apply',
    'Applications',
    'Profile',
    'Watches',
    'Settings',
  ]);

  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emma’s Profile');
  await expect(page).toHaveTitle('Profile · Job Finder');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Facts', 'Uploads', 'New file', 'Watches']);
  await expect(page.getByText('No Upload yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save the Facts' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'New file' }).getByRole('textbox', { name: 'File name' }),
  ).toBeVisible();
  const newWatch = page.getByRole('group', { name: 'New Watch' });
  await expect(newWatch.getByRole('textbox', { name: 'Searched title' })).toBeVisible();
  await expect(newWatch.getByRole('button', { name: 'Create the Watch' })).toBeVisible();
});

test('shows the Instructions and the Settings in English to a Candidate with the en locale', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('emma');
  await openPage('/instructions');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Emma’s Instructions');
  await expect(page).toHaveTitle('Instructions · Job Finder');
  const letter = page.getByRole('region', { name: 'Letter' });
  await expect(letter.getByText('Default Instructions', { exact: true })).toBeVisible();
  // The default Instructions of her locale; the Letter itself is written in the Job Description's
  await expect(letter.getByRole('textbox')).toHaveValue(/^Write a one-page cover letter/);
  await expect(letter.getByRole('button', { name: 'Save my Instructions' })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page).toHaveTitle('Settings · Job Finder');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Notifications',
    'Candidates',
    'Default Deadline Period',
  ]);
  const notifications = page.getByRole('region', { name: 'Notifications', exact: true });
  await expect(notifications.getByRole('combobox', { name: 'Notification Channel' })).toHaveValue('home-assistant');
  await expect(notifications.getByRole('textbox', { name: 'Home Assistant address' })).toBeVisible();
  await expect(notifications.getByRole('button', { name: 'Send a test notification' })).toBeVisible();
});

test('shows the tools of the Posting list in English to a Candidate with the en locale', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('emma');
  await openPage('/postings');

  // A Detection another test runs hides the button behind its progress, in English too (ADR-0014)
  await expect(
    page
      .getByRole('button', { name: 'Run a Detection' })
      .or(page.getByRole('region', { name: 'Detection in progress' })),
  ).toBeVisible();
  await expect(page.getByText('Import a Job Description')).toBeVisible();
  const filters = page.getByRole('search', { name: 'Filters' });
  await expect(filters.getByRole('combobox', { name: 'City' })).toBeVisible();
  await expect(filters.getByRole('combobox', { name: 'Region' })).toBeVisible();
  await expect(filters.getByRole('checkbox', { name: 'Show the Archived' })).toBeVisible();
  await expect(filters.getByRole('button', { name: 'Filter' })).toBeVisible();
});

test('shows To Apply over the map in English to a Candidate with the en locale', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('emma');
  await openPage('/to-apply');

  await expect(page).toHaveTitle('To Apply · Job Finder');
  const panel = page.getByRole('complementary', { name: 'To Apply' });
  // Imported without a Deadline, and without a place the map could show
  await expect(panel.getByRole('heading', { level: 2 })).toHaveText([/^No Deadline/]);
  await expect(panel.getByRole('listitem')).toHaveText([/^Unknown place/]);
  await expect(panel.getByLabel('Research: none yet')).toBeVisible();
  await expect(page.getByText('1 Posting without a known place')).toBeVisible();
});

// Oliver reads the interface in English too, and owns the one Posting this test changes
// (test/seed-front.ts): imported, its fields unread, with a Research. Archived then unarchived
// back to To Apply, it ends as it started.
test('takes a Candidate with the en locale through a Posting and its Status in English', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('oliver');
  await openPage('/postings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Oliver’s Postings');
  await page.getByRole('checkbox', { name: 'Show the Archived' }).check();
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByRole('link', { name: 'registry-officer-douai.md' }).click();
  const stepBadge = page.locator('main > header [data-step]');
  const unarchive = page.getByRole('button', { name: 'Unarchive' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('registry-officer-douai.md');
  // Left Archived by a run stopped halfway
  if (await unarchive.isVisible()) {
    await unarchive.click();
  }
  await expect(stepBadge).toHaveText('To Apply');

  await expect(page).toHaveTitle('registry-officer-douai.md · Job Finder');
  await expect(page.getByRole('tab')).toHaveText([
    'Posting',
    'Research (Draft)',
    'Letter (None)',
    'Interviews',
    'Notes',
  ]);
  await expect(page.getByRole('region', { name: 'Key facts' }).getByRole('term')).toHaveText([
    'Deadline',
    'Start date',
    'Published',
    'Reference',
  ]);
  await expect(page.getByRole('region', { name: 'Contacts' })).toContainText('No contact in the Posting.');
  const extraction = page.getByRole('form', { name: 'Fields read by Claude' });
  await expect(extraction.getByRole('status')).toHaveText('Failed');
  await expect(extraction.getByRole('button', { name: 'Run the extraction again' })).toBeVisible();
  await page.getByRole('tab', { name: /^Research/ }).click();
  const research = page.getByRole('region', { name: 'Research', exact: true });
  await expect(research.getByRole('button', { name: 'Run the Research again' })).toBeVisible();
  await expect(research.getByRole('combobox', { name: 'Version' })).toHaveText('Version 1 · Draft');
  await expect(research.getByText('Version 1 is a Draft: read it, then validate it')).toBeVisible();
  await expect(research.getByRole('button', { name: 'Validate Version 1' })).toBeVisible();
  await expect(research.getByText('Default Instructions · Instructions of this Version')).toBeVisible();
  await page.getByRole('tab', { name: /^Letter/ }).click();
  const letter = page.getByRole('region', { name: 'Letter', exact: true });
  await expect(letter.getByRole('button', { name: 'Run the Letter' })).toBeVisible();
  await expect(letter.getByText('No Letter yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Applied' })).toBeVisible();

  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();

  await expect(stepBadge).toHaveText('To Apply · archived');
  await expect(page.getByText('Posting archived')).toBeVisible();
  await unarchive.click();
  await expect(stepBadge).toHaveText('To Apply');
});
