import { expect, test, type Page } from '@playwright/test';

async function expectFrench(page: Page, heading: string) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page).toHaveTitle('Accueil · Job Finder');
  await expect(page.getByRole('navigation', { name: 'Pages' }).getByRole('link')).toHaveText([
    'Accueil',
    'Offres',
    'Profil',
    'Consignes',
    'Candidats',
  ]);
}

async function expectEnglish(page: Page, heading: string) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Home · Job Finder');
  await expect(page.getByRole('navigation', { name: 'Pages' }).getByRole('link')).toHaveText([
    'Home',
    'Postings',
    'Profile',
    'Instructions',
    'Candidates',
  ]);
}

// Nina's locale, which this test alone changes (test/seed-front.ts), is put back to French first: a
// run stopped halfway may have left it in English
test('switches the whole site of a Candidate to English, for good, and back to French', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption('Nina');
  await page.getByRole('button', { name: 'Choisir' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Nina/);
  await page.getByRole('button', { name: /^(Français|French)$/ }).click();
  await expectFrench(page, 'Bonjour Nina');
  await expect(page.getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('form', { name: 'Langue' }).getByRole('button', { name: 'Anglais' }).click();
  await expectEnglish(page, 'Hello Nina');
  await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');

  // Saved on Nina: the server renders the next visit in English at once
  await page.reload();
  await expectEnglish(page, 'Hello Nina');

  await page.getByRole('form', { name: 'Language' }).getByRole('button', { name: 'French' }).click();
  await expectFrench(page, 'Bonjour Nina');
});

// With no Candidate chosen, the locale is kept in a cookie of this browser only
test('switches the site to English before any Candidate is chosen, and back to French', async ({ page }) => {
  await page.goto('/');
  await expectFrench(page, 'Qui consulte ses Offres ?');

  await page.getByRole('button', { name: 'Anglais' }).click();
  await expectEnglish(page, 'Who is looking at their Postings?');

  await page.reload();
  await expectEnglish(page, 'Who is looking at their Postings?');

  await page.getByRole('button', { name: 'French' }).click();
  await expectFrench(page, 'Qui consulte ses Offres ?');
});
