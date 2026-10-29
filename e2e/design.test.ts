import { expect, test } from '@playwright/test';

const DATE = /^\d{2}\/\d{2}\/\d{4}$/;

test.describe('design system page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/design');
  });

  test('shows a badge for each statut of an Offre', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Statuts d’une Offre' });

    await expect(section.getByRole('listitem')).toHaveText(['À traiter', 'Postulée', 'Expirée', 'Archivée']);
  });

  test('shows a badge for each état of an Artefact', async ({ page }) => {
    const section = page.getByRole('region', { name: 'États d’un Artefact' });

    await expect(section.getByRole('listitem')).toHaveText(['Absent', 'En cours', 'Prêt', 'En échec']);
  });

  test('lists the Offres with their link, statut, publication date and Date limite', async ({ page }) => {
    const table = page.getByRole('region', { name: 'Liste d’Offres' }).getByRole('table');
    const firstRow = table.getByRole('row').nth(1);

    await expect(table.getByRole('columnheader')).toHaveText(['Offre', 'Statut', 'Publiée le', 'Date limite']);
    await expect(firstRow.getByRole('link')).toHaveAttribute('href', /^https:\/\//);
    await expect(firstRow.getByRole('cell')).toHaveText([/Attaché de justice/, 'À traiter', DATE, DATE]);
  });

  test('says when there is no Offre yet', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Liste vide' });

    await expect(section).toContainText('Aucune Offre pour l’instant');
  });

  test('shows the fiche of an Offre with its contacts and the état of each Artefact', async ({ page }) => {
    const fiche = page.getByRole('region', { name: 'Fiche d’une Offre' });

    await expect(fiche.getByRole('heading', { level: 3 })).toHaveText(/Attaché de justice/);
    await expect(fiche.getByRole('term')).toContainText(['Mail de candidature', 'Contact 1', 'Contact 2']);
    await expect(fiche.getByRole('list', { name: 'Artefacts' }).getByRole('listitem')).toHaveText([
      /^Recherche.*(Absent|En cours|Prêt|En échec)$/,
      /^Lettre.*(Absent|En cours|Prêt|En échec)$/,
      /^Fiche d’entretien.*(Absent|En cours|Prêt|En échec)$/,
      /^Visualisation.*(Absent|En cours|Prêt|En échec)$/,
    ]);
  });

  test('previews the Markdown as it is typed', async ({ page }) => {
    const editor = page.getByRole('region', { name: 'Éditeur Markdown' });

    await editor.getByRole('textbox', { name: 'Lettre' }).fill('# Objet de la lettre\n\nMadame, Monsieur,');

    await expect(editor.getByRole('heading', { name: 'Objet de la lettre' })).toBeVisible();
  });

  // Léa reads the front on her phone through the VPN. overflow-x: clip hides a horizontal
  // scrollbar, so the check is that nothing runs past the right edge, where it would be cut off.
  test('fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const overflowingList = await page
      .locator('body')
      .evaluate((body) =>
        [...body.querySelectorAll('*')]
          .filter((element) => element.getBoundingClientRect().right > body.ownerDocument.documentElement.clientWidth)
          .map((element) => element.outerHTML.slice(0, 80)),
      );

    expect(overflowingList).toEqual([]);
  });
});
