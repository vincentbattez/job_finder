import { expect, test, type Page } from '@playwright/test';

import { findOverflowing } from './overflow.ts';

// The front runs on the data that test/seed-front.ts made through the actions, with the HTTP of
// the PEP Source recorded on 2026-10-29: Léa follows the attaché de justice Postings, Camille has
// no Watch
const BETHUNE_TITLE = 'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE';

// The menu leads to the home of the Candidate chosen, then their Postings open at /postings
async function chooseCandidate(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption(name);
  await page.getByRole('button', { name: 'Choisir' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Bonjour ${name}`);
  await page.goto('/postings');
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
    await expect(page.getByRole('combobox', { name: 'Candidat' })).toHaveValue('camille');
    await expect(page.getByText('Aucune Offre pour l’instant')).toBeVisible();
  });

  test('opens a Posting with its Job Description and its raw contacts', async ({ page }) => {
    await chooseCandidate(page, 'Léa');

    await page.getByRole('link', { name: BETHUNE_TITLE }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(BETHUNE_TITLE);
    const contacts = page.getByRole('region', { name: 'Contacts' });
    await expect(contacts.getByRole('definition')).toHaveText([
      'p.tj-bethune@justice.fr',
      'Madame Odile SIMART, présidente du Tribunal Judiciaire de Béthune',
      'secrétariat en copie : sec.p.tj-bethune@justice.fr',
    ]);
    // Long as published, the Job Description stays folded below the Artifacts until it is opened
    const jobDescription = page.getByRole('region', { name: 'Fiche de poste' });
    await jobDescription.getByText('Lire la Fiche de poste').click();
    await expect(
      jobDescription.getByText('La présente fiche de poste concerne une affectation auprès du tribunal pour enfants.'),
    ).toBeVisible();
  });

  test('names the Posting page after its Posting', async ({ page }) => {
    await page.goto('/postings/2026-2445600');

    await expect(page).toHaveTitle(`${BETHUNE_TITLE} · Job Finder`);
  });

  test('shows the recipients the Letter recommends, each with the field it comes from', async ({ page }) => {
    await page.goto('/postings/2026-2445600');

    const recipients = page.getByRole('region', { name: 'Destinataires recommandés' });
    await expect(recipients.getByRole('definition')).toHaveText([
      /^p\.tj-bethune@justice\.fr\s*Mail de candidature$/,
      /^sec\.p\.tj-bethune@justice\.fr\s*Contact 2$/,
      /^Madame la Présidente,\s*Contact 1$/,
    ]);
    await expect(recipients).toContainText('Le mail de candidature est celui de la présidence');
  });

  test('shows every Version of an Artifact and tells the Chosen Version', async ({ page }) => {
    await page.goto('/postings/2026-2445600');

    const research = page.getByRole('region', { name: 'Recherche' });
    await expect(research.locator('li > details > summary')).toHaveText([
      /^v1\s*Prêt\s*Retenue/,
      /^v2\s*Prêt\s*Consignes par défaut\s*\d/,
    ]);
    await expect(research.getByRole('heading', { name: /^Recherche retenue/ })).toBeVisible();
    await expect(research.getByRole('heading', { name: /^Recherche relancée/ })).toBeHidden();
    await research.locator('li > details > summary', { hasText: 'v2' }).click();
    await expect(research.getByRole('heading', { name: /^Recherche relancée/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Lettre' }).locator('figcaption')).toHaveText([
      'draft.md',
      'letter.md',
    ]);
    // The Interview Brief belongs to an Interview, which a To Apply Posting has none of
    await expect(page.getByRole('region', { name: 'Fiche d’entretien' })).toHaveCount(0);
  });

  test('copies the jf edit command of an Artifact', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/postings/2026-2445600');
    const research = page.getByRole('region', { name: 'Recherche' });

    await expect(research.getByRole('code')).toHaveText('jf edit 2026-2445600 research');
    // A click before React hydrates the server-rendered page does nothing: click again until it copies
    await expect(async () => {
      await research.getByRole('button', { name: 'Copier', exact: true }).click();
      expect(await page.evaluate(() => globalThis.navigator.clipboard.readText())).toBe(
        'jf edit 2026-2445600 research',
      );
    }).toPass();
    await expect(page.getByRole('region', { name: 'Fiche d’entretien' }).getByRole('code')).toHaveCount(0);
  });

  test('fits a phone screen, the list as the Posting page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await chooseCandidate(page, 'Léa');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Léa');

    await expect.poll(() => findOverflowing(page)).toEqual([]);

    await page.goto('/postings/2026-2445600');
    await page.locator('li > details > summary', { hasText: 'v2' }).click();
    await page.getByText('Lire la Fiche de poste').click();

    await expect.poll(() => findOverflowing(page)).toEqual([]);
  });

  test('asks who is there before showing any Posting', async ({ page }) => {
    await page.goto('/postings');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qui consulte ses Offres ?');
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});
