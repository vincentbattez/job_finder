import { expect, test } from '@playwright/test';

const DATE = /^\d{2}\/\d{2}\/\d{4}$/;

test.describe('design system page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/design');
  });

  test('shows a badge for each status of a Posting', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Statuts d’une Offre' });

    await expect(section.getByRole('listitem')).toHaveText([
      'À traiter',
      'Postulée',
      'Convoquée',
      'Entretien passé',
      'Poste obtenu',
      'Refusée',
      'Expirée',
      'Archivée',
      'Dépubliée',
    ]);
  });

  test('shows a badge for each state of an Artifact', async ({ page }) => {
    const section = page.getByRole('region', { name: 'États d’un Artefact' });

    await expect(section.getByRole('listitem')).toHaveText(['Absent', 'En attente', 'En cours', 'Prêt', 'En échec']);
  });

  test('lists the Postings with their link, status, publication date and Deadline', async ({ page }) => {
    const table = page.getByRole('region', { name: 'Liste d’Offres' }).getByRole('table');
    const firstRow = table.getByRole('row').nth(1);

    await expect(table.getByRole('columnheader')).toHaveText(['Offre', 'Statut', 'Publiée le', 'Date limite']);
    await expect(firstRow.getByRole('link', { name: '2026-0000101' })).toHaveAttribute('href', /^https:\/\//);
    await expect(firstRow.getByRole('link', { name: /Attaché de justice/ })).toHaveAttribute(
      'href',
      '/postings/2026-0000101',
    );
    await expect(firstRow.getByRole('cell')).toHaveText([/Attaché de justice/, 'À traiter', DATE, DATE]);
  });

  test('says when there is no Posting yet', async ({ page }) => {
    const section = page.getByRole('region', { name: 'Liste vide' });

    await expect(section).toContainText('Aucune Offre pour l’instant');
  });

  test('shows the Posting page with its contacts and the state of each Artifact', async ({ page }) => {
    const detail = page.getByRole('region', { name: 'Fiche d’une Offre' });

    await expect(detail.getByRole('heading', { level: 3 })).toHaveText(/Attaché de justice/);
    await expect(detail.getByRole('term')).toContainText(['Mail de candidature', 'Contact 1', 'Contact 2']);
    await expect(detail.getByRole('region', { name: 'Artefacts' }).getByRole('listitem')).toHaveText([
      /^Recherche.*(Absent|En attente|En cours|Prêt|En échec)$/,
      /^Lettre.*(Absent|En attente|En cours|Prêt|En échec)$/,
      /^Fiche d’entretien.*(Absent|En attente|En cours|Prêt|En échec)$/,
    ]);
  });

  test('previews the Markdown as it is typed', async ({ page }) => {
    const editor = page.getByRole('region', { name: 'Éditeur Markdown' });
    await editor.getByRole('textbox', { name: 'Lettre' }).fill('# Objet de la lettre\n\nMadame, Monsieur,');

    await expect(editor.getByRole('heading', { name: 'Objet de la lettre' })).toBeVisible();
  });

  // A Research sums up its figures in GitHub tables, which plain Markdown would show as raw pipes
  test('previews a Markdown table as a table', async ({ page }) => {
    const editor = page.getByRole('region', { name: 'Éditeur Markdown' });
    await editor
      .getByRole('textbox', { name: 'Lettre' })
      .fill('| Ressort | Population |\n|---|---|\n| Béziers | 323 000 |');

    const table = editor.getByRole('table');
    await expect(table.getByRole('columnheader')).toHaveText(['Ressort', 'Population']);
    await expect(table.getByRole('cell')).toHaveText(['Béziers', '323 000']);
  });

  // Léa reads the front on her phone through the VPN (ADR-0002). overflow-x: clip hides a horizontal
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

// The server's page shows the editor before React runs it. Text typed there would be overwritten by
// React taking over the field, and on Chromium the text typed meanwhile lands at its start: the
// editor waits for React instead.
test.describe('design system page before React runs', () => {
  test.use({ javaScriptEnabled: false });

  test('takes no text in the Markdown editor', async ({ page }) => {
    await page.goto('/design');

    await expect(
      page.getByRole('region', { name: 'Éditeur Markdown' }).getByRole('textbox', { name: 'Lettre' }),
    ).not.toBeEditable();
  });
});
