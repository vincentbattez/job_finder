import type { Page } from '@playwright/test';

import { expect, switchCandidate, test } from './candidate.ts';
import { findOverflowing } from './overflow.ts';

// The front runs on the data that test/seed-front.ts made through the actions, with the HTTP of
// the PEP Source recorded on 2026-10-29: Léa follows the attaché de justice Postings, Camille has
// no Watch
const BETHUNE_TITLE = 'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE';

// The switcher keeps the page: the two tests of the switch go through it, the others choose with
// asCandidate
async function chooseCandidate(page: Page, name: string) {
  await page.goto('/postings');
  await switchCandidate(page, name);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Offres de ${name}`);
}

test.describe('Postings of a Candidate', () => {
  test('lists the Postings of the Candidate chosen in the menu', async ({ page }) => {
    await chooseCandidate(page, 'Léa');

    const row = page.getByRole('row', { name: /2026-2445600/ });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Léa');
    await expect(row.getByRole('cell')).toHaveText([
      new RegExp(`^${BETHUNE_TITLE}`),
      /^(À traiter|Expirée)$/,
      '20/10/2026',
      '20/11/2026',
    ]);
    await expect(row.getByRole('link', { name: '2026-2445600' })).toHaveAttribute(
      'href',
      'https://choisirleservicepublic.gouv.fr/offre-emploi/2026-2445600/?tracking=1&idOrigine=502',
    );
  });

  test('remembers the chosen Candidate on the next visit', async ({ page }) => {
    await chooseCandidate(page, 'Camille');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Camille');

    await page.goto('/postings');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Camille');
    await expect(page.getByRole('button', { name: 'Changer de Candidat' })).toContainText('Camille');
    await expect(page.getByText('Aucune Offre pour l’instant')).toBeVisible();
  });

  test('opens a Posting with its Job Description', async ({ page, asCandidate, openPage }) => {
    await asCandidate('lea');
    await openPage('/postings');

    await page.getByRole('link', { name: BETHUNE_TITLE }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(BETHUNE_TITLE);
    await expect(
      page
        .getByRole('region', { name: 'Fiche de poste' })
        .getByText('La présente fiche de poste concerne une affectation auprès du tribunal pour enfants.'),
    ).toBeVisible();
  });

  test('reads the latest Version of an Artifact, and any other from its Version Select', async ({ page, openPage }) => {
    await openPage('/postings/2026-2445600?tab=research');

    const research = page.getByRole('region', { name: 'Recherche' });
    const versionSelect = research.getByRole('combobox', { name: 'Version' });
    await expect(versionSelect).toHaveText('Version 2 · Brouillon');
    await expect(research.getByRole('heading', { name: /^Recherche relancée/ })).toBeVisible();
    await versionSelect.click();
    await expect(page.getByRole('option')).toHaveText([
      /^Version 2\s*Brouillon · IA/,
      /^Version 1\s*Validée · retenue · IA/,
    ]);
    await page.getByRole('option', { name: /^Version 1/ }).click();
    await expect(research.getByRole('heading', { name: /^Recherche retenue/ })).toBeVisible();
    await expect(research.getByRole('heading', { name: /^Recherche relancée/ })).toBeHidden();
    await page.getByRole('tab', { name: /^Lettre de motivation/ }).click();
    await expect(page.getByRole('region', { name: 'Lettre de motivation' })).toContainText('Madame la Présidente,');
  });

  test('fits a phone screen, the list as the Posting page', async ({ page, asCandidate, openPage }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await asCandidate('lea');
    await openPage('/postings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Léa');

    await expect.poll(() => findOverflowing(page)).toEqual([]);

    await openPage('/postings/2026-2445600');
    await expect.poll(() => findOverflowing(page)).toEqual([]);
    await openPage('/postings/2026-2445600?tab=research');
    await expect(page.getByRole('combobox', { name: 'Version' })).toBeVisible();

    await expect.poll(() => findOverflowing(page)).toEqual([]);
  });

  test('asks who is there before showing any Posting', async ({ page }) => {
    await page.goto('/postings');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qui consulte ses Offres ?');
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});
