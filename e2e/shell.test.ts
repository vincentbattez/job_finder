import type { Page } from '@playwright/test';

import { expect, switchCandidate, test } from './candidate.ts';

// The shell around every page (spec #125, « Shell and navigation »): the Sidebar, its Candidate
// switcher, the theme toggle and the Locale Switcher. Only Nina's locale changes here, and only the
// candidate cookie and the theme of each test's own browser otherwise.
const BETHUNE_REFERENCE = '2026-2445600';

function findPages(page: Page) {
  return page.getByRole('navigation', { name: 'Pages' });
}

test('leads to every page of the journey from the Sidebar', async ({ page, asCandidate, openPage }) => {
  await asCandidate('lea');
  await openPage('/');

  await expect(findPages(page).getByRole('link')).toHaveText([
    'Nouvelles',
    'À traiter',
    'Candidatures',
    'Profil',
    'Veilles',
    'Réglages',
  ]);
  await findPages(page).getByRole('link', { name: 'Candidatures' }).click();

  await expect(page).toHaveURL('/applications');
  await expect(findPages(page).getByRole('link', { name: 'Candidatures' })).toHaveAttribute('aria-current', 'page');
});

test('switches Candidate and stays on the same page', async ({ page, asCandidate, openPage }) => {
  await asCandidate('lea');
  await openPage('/applications');
  await expect(page.getByRole('complementary', { name: 'Candidatures' })).toBeVisible();

  await switchCandidate(page, 'Camille');

  await expect(page.getByText('Tu consultes les Offres de Camille.')).toBeVisible();
  await expect(page).toHaveURL('/applications');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Candidatures');
  await expect(page.getByRole('button', { name: 'Changer de Candidat' })).toContainText('Camille');
});

// The Posting belongs to the Candidate left: the switch leads to New instead
test('switches Candidate from a Posting page to New', async ({ page, asCandidate, openPage }) => {
  await asCandidate('lea');
  await openPage(`/postings/${BETHUNE_REFERENCE}`);

  await switchCandidate(page, 'Camille');

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nouvelles');
  await expect(page.getByRole('button', { name: 'Changer de Candidat' })).toContainText('Camille');
});

test('collapses the Sidebar into an icon rail with tooltips', async ({ page, asCandidate, openPage }) => {
  await asCandidate('lea');
  await openPage('/');
  const sidebar = page.locator('[data-slot="sidebar"]');

  await page.getByRole('main').getByRole('button', { name: 'Replier ou déplier le menu' }).click();

  await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
  await findPages(page).getByRole('link', { name: 'Candidatures' }).hover();
  await expect(page.getByRole('tooltip', { name: 'Candidatures' })).toBeVisible();
});

test('switches to the dark theme, for good, and back', async ({ page, openPage }) => {
  await openPage('/');
  const html = page.locator('html');
  const toggle = page.getByRole('button', { name: 'Basculer entre le thème clair et le thème sombre' });
  await expect(html).not.toHaveClass(/dark/);

  await toggle.click();
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/);

  await toggle.click();
  await expect(html).not.toHaveClass(/dark/);
});

// `/` opens New, whose header says what it holds
async function expectFrench(page: Page, text: string) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nouvelles');
  await expect(page.getByRole('main')).toContainText(text);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page).toHaveTitle('Nouvelles · Job Finder');
  await expect(findPages(page).getByRole('link').first()).toHaveText('Nouvelles');
}

async function expectEnglish(page: Page, text: string) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New');
  await expect(page.getByRole('main')).toContainText(text);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('New · Job Finder');
  await expect(findPages(page).getByRole('link')).toHaveText([
    'New',
    'To Apply',
    'Applications',
    'Profile',
    'Watches',
    'Settings',
  ]);
}

// Nina's locale, which this test alone changes (test/seed-front.ts), is put back to French first: a
// run stopped halfway may have left it in English
test('switches the whole site of a Candidate to English, for good, and back to French', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await asCandidate('nina');
  await openPage('/');
  await expect(page.getByRole('button', { name: /^(Changer de Candidat|Switch Candidate)$/ })).toContainText('Nina');
  await page.getByRole('button', { name: /^(Français|French)$/ }).click();
  await expectFrench(page, 'Rien à trier');
  await expect(page.getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('form', { name: 'Langue' }).getByRole('button', { name: 'Anglais' }).click();
  await expectEnglish(page, 'Nothing to sort');
  await expect(page.getByText('The interface is in English.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');

  // Saved on Nina: the server renders the next visit in English at once
  await page.reload();
  await expectEnglish(page, 'Nothing to sort');

  await page.getByRole('form', { name: 'Language' }).getByRole('button', { name: 'French' }).click();
  await expectFrench(page, 'Rien à trier');
});

// With no Candidate chosen, the locale is kept in a cookie of this browser only
test('switches the site to English before any Candidate is chosen, and back to French', async ({ page, openPage }) => {
  await openPage('/');
  await expectFrench(page, 'Qui consulte ses Offres ?');
  await expect(page.getByRole('button', { name: 'Changer de Candidat' })).toContainText('Choisis un Candidat');

  await page.getByRole('button', { name: 'Anglais' }).click();
  await expectEnglish(page, 'Who is looking at their Postings?');

  await page.reload();
  await expectEnglish(page, 'Who is looking at their Postings?');

  await page.getByRole('button', { name: 'French' }).click();
  await expectFrench(page, 'Qui consulte ses Offres ?');
});
