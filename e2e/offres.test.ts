import { expect, test, type Page } from '@playwright/test';

// The front runs on the data that test/seed-front.ts made through the actions, with the HTTP of
// the PEP Source recorded on 2026-10-29: Léa follows the attaché de justice Offres, Camille has
// no Veille
const BETHUNE_TITLE = 'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE';

async function chooseCandidat(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption(name);
  await page.getByRole('button', { name: 'Choisir' }).click();
}

// Léa reads the front on her phone through the VPN (ADR-0002). overflow-x: clip hides a horizontal
// scrollbar, so the check is that nothing runs past the right edge, where it would be cut off. The
// map lays its tiles and points out past its edges and clips them: only the map itself counts.
function findOverflowing(page: Page): Promise<string[]> {
  return page.locator('body').evaluate((body) =>
    [...body.querySelectorAll('*')]
      .filter((element) => element.parentElement?.closest('.leaflet-container') === null)
      .filter((element) => element.getBoundingClientRect().right > body.ownerDocument.documentElement.clientWidth)
      .map((element) => element.outerHTML.slice(0, 80)),
  );
}

test.describe('Offres of a Candidat', () => {
  test('lists the Offres of the Candidat chosen in the menu', async ({ page }) => {
    await page.goto('/');

    await chooseCandidat(page, 'Léa');

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

  test('remembers the chosen Candidat on the next visit', async ({ page }) => {
    await page.goto('/');
    await chooseCandidat(page, 'Camille');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Camille');

    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Camille');
    await expect(page.getByRole('combobox', { name: 'Candidat' })).toHaveValue('camille');
    await expect(page.getByText('Aucune Offre pour l’instant')).toBeVisible();
  });

  test('opens an Offre with its Fiche de poste and its raw contacts', async ({ page }) => {
    await page.goto('/');
    await chooseCandidat(page, 'Léa');

    await page.getByRole('link', { name: BETHUNE_TITLE }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(BETHUNE_TITLE);
    const contacts = page.getByRole('region', { name: 'Contacts' });
    await expect(contacts.getByRole('definition')).toHaveText([
      'p.tj-bethune@justice.fr',
      'Madame Odile SIMART, présidente du Tribunal Judiciaire de Béthune',
      'secrétariat en copie : sec.p.tj-bethune@justice.fr',
    ]);
    // Long as published, the Fiche de poste stays folded below the Artefacts until it is opened
    const ficheDePoste = page.getByRole('region', { name: 'Fiche de poste' });
    await ficheDePoste.getByText('Lire la Fiche de poste').click();
    await expect(
      ficheDePoste.getByText('La présente fiche de poste concerne une affectation auprès du tribunal pour enfants.'),
    ).toBeVisible();
  });

  test('shows the recipients the Lettre recommends, each with the field it comes from', async ({ page }) => {
    await page.goto('/offres/2026-2445600');

    const recipients = page.getByRole('region', { name: 'Destinataires recommandés' });
    await expect(recipients.getByRole('definition')).toHaveText([
      /^p\.tj-bethune@justice\.fr\s*Mail de candidature$/,
      /^sec\.p\.tj-bethune@justice\.fr\s*Contact 2$/,
      /^Madame la Présidente,\s*Contact 1$/,
    ]);
    await expect(recipients).toContainText('Le mail de candidature est celui de la présidence');
  });

  test('shows every Version of an Artefact and tells the Version retenue', async ({ page }) => {
    await page.goto('/offres/2026-2445600');

    const recherche = page.getByRole('region', { name: 'Recherche' });
    await expect(recherche.locator('summary')).toHaveText([
      /^v1\s*Prêt\s*Retenue/,
      /^v2\s*Prêt\s*Consignes par défaut\s*\d/,
    ]);
    await expect(recherche.getByRole('heading', { name: /^Recherche retenue/ })).toBeVisible();
    await expect(recherche.getByRole('heading', { name: /^Recherche relancée/ })).toBeHidden();
    await recherche.locator('summary', { hasText: 'v2' }).click();
    await expect(recherche.getByRole('heading', { name: /^Recherche relancée/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Lettre' }).locator('figcaption')).toHaveText([
      'brouillon.md',
      'lettre.md',
    ]);
    await expect(page.getByRole('region', { name: 'Fiche d’entretien' })).toContainText('Aucune Version');
  });

  test('copies the jf edit command of an Artefact', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/offres/2026-2445600');
    const recherche = page.getByRole('region', { name: 'Recherche' });

    await expect(recherche.getByRole('code')).toHaveText('jf edit 2026-2445600 recherche');
    // A click before React hydrates the server-rendered page does nothing: click again until it copies
    await expect(async () => {
      await recherche.getByRole('button', { name: 'Copier', exact: true }).click();
      expect(await page.evaluate(() => globalThis.navigator.clipboard.readText())).toBe(
        'jf edit 2026-2445600 recherche',
      );
    }).toPass();
    await expect(page.getByRole('region', { name: 'Fiche d’entretien' }).getByRole('code')).toHaveCount(0);
  });

  test('fits a phone screen, the list as the fiche', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await chooseCandidat(page, 'Léa');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offres de Léa');

    expect(await findOverflowing(page)).toEqual([]);

    await page.goto('/offres/2026-2445600');
    await page.locator('summary', { hasText: 'v2' }).click();
    await page.getByText('Lire la Fiche de poste').click();

    expect(await findOverflowing(page)).toEqual([]);
  });

  test('asks who is there before showing any Offre', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qui consulte ses Offres ?');
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});
