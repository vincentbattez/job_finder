import type { Page } from '@playwright/test';

import { expect, test, type IFront } from './candidate.ts';
import { paulReferenceOf, type Journey } from './paul.ts';

// Léa's Béthune Posting, which no test changes, and the Boulogne parquet Position, published as
// 2026-2231960 then again as 2026-2338409 (feed recorded on 2026-10-29)
const BETHUNE_REFERENCE = '2026-2445600';
const BETHUNE_TITLE = 'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE';
const REFERENCE = '2026-2231960';
const REPOST_REFERENCE = '2026-2338409';

function findStepBadge(page: Page) {
  return page.locator('main > header [data-step]');
}

function findMoreActions(page: Page) {
  return page.getByRole('button', { name: 'Plus d’actions' });
}

// One of Paul's Postings, each the subject of one journey only (test/paul.ts), as the request left it
async function openJourney(
  { page, openPage }: IFront,
  journey: Journey,
  reset: { path: string; form: Record<string, string> },
) {
  const reference = paulReferenceOf(journey);
  const response = await page.request.post(`/postings/${reference}/${reset.path}`, { form: reset.form });
  expect(response.ok()).toBe(true);
  await openPage(`/postings/${reference}`);
  return reference;
}

test.describe('the header of the Posting page', () => {
  test('shows the title, employer, City and Deadline, and the Step', async ({ page, openPage }) => {
    await openPage(`/postings/${BETHUNE_REFERENCE}`);

    const header = page.locator('main > header');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(BETHUNE_TITLE);
    await expect(header.getByText(/· Date limite 20\/11\/2026$/)).toBeVisible();
    await expect(findStepBadge(page)).toHaveText(/^(À traiter)$/);
    await expect(page).toHaveTitle(`${BETHUNE_TITLE} · Job Finder`);
    await findMoreActions(page).click();
    await expect(page.getByRole('menuitem', { name: 'Ouvrir sur sa Source' })).toHaveAttribute(
      'href',
      'https://choisirleservicepublic.gouv.fr/offre-emploi/2026-2445600/?tracking=1&idOrigine=502',
    );
  });

  test('marks a To Apply Posting Applied without a Letter, offers to add an Interview, then puts it back To Apply', async ({
    page,
    openPage,
  }) => {
    const front = { page, openPage };
    await openJourney(front, 'applied', { path: 'status', form: { status: 'to_apply' } });
    await expect(findStepBadge(page)).toHaveText('À traiter');

    // Without a Validated Letter, Applied asks first: the Candidate may have applied another way
    await page.getByRole('button', { name: 'Marquer Postulée' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Marquer l’Offre Postulée ?' });
    await expect(dialog).toContainText('Cette Offre n’a pas de Lettre de motivation validée.');
    await dialog.getByRole('button', { name: 'Marquer Postulée sans Lettre de motivation' }).click();

    await expect(page.getByText('Offre passée à « Postulée »')).toBeVisible();
    await expect(findStepBadge(page)).toHaveText('Postulée');
    // Adding an Interview opens its Dialog on the page as it is
    await page.getByRole('button', { name: 'Ajouter un Entretien' }).click();
    await expect(page.getByRole('dialog', { name: 'Ajouter un Entretien' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    // An Applied Posting without an Interview was maybe never sent
    await findMoreActions(page).click();
    await page.getByRole('menuitem', { name: 'Remettre À traiter (pas envoyée)' }).click();
    await expect(findStepBadge(page)).toHaveText('À traiter');
    await expect(page.getByRole('button', { name: 'Marquer Postulée' })).toBeVisible();
  });

  test('records the outcome of an Interviewed Application, then puts it back In progress', async ({
    page,
    openPage,
  }) => {
    const front = { page, openPage };
    await openJourney(front, 'interviewed', { path: 'status', form: { status: 'applied' } });
    await expect(findStepBadge(page)).toHaveText('Entretien passé');
    // An Interview proves the Letter was sent: no way back To Apply
    await findMoreActions(page).click();
    await expect(page.getByRole('menuitem')).toHaveText([
      'Ajouter un Entretien',
      'Poste obtenu',
      'Refusée',
      'Archiver',
    ]);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Indiquer le résultat' }).click();
    await page.getByRole('menuitem', { name: 'Poste obtenu' }).click();

    await expect(findStepBadge(page)).toHaveText('Poste obtenu');
    await page.getByRole('button', { name: 'Remettre en cours' }).click();
    await expect(findStepBadge(page)).toHaveText('Entretien passé');
    await expect(page.getByRole('button', { name: 'Indiquer le résultat' })).toBeVisible();
  });

  test('leads an Invited Application to the Revision of its next Interview, out of the Sidebar', async ({
    page,
    openPage,
  }) => {
    const front = { page, openPage };
    await openJourney(front, 'invited', { path: 'status', form: { status: 'applied' } });
    await expect(findStepBadge(page)).toHaveText('Convoquée');

    await page.getByRole('link', { name: 'Réviser l’Entretien 1' }).click();

    await expect(page).toHaveURL(/\/interviews\/1\/revision$/);
    await expect(page.getByRole('heading', { name: 'Réviser l’Entretien 1' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pages' })).toHaveCount(0);
  });

  test('archives at once with an undo in its toast, then unarchives', async ({ page, openPage }) => {
    const front = { page, openPage };
    await openJourney(front, 'archive', { path: 'archive', form: { intent: 'unarchive' } });

    await findMoreActions(page).click();
    await page.getByRole('menuitem', { name: 'Archiver' }).click();

    await expect(findStepBadge(page)).toHaveText('À traiter · archivée');
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Offre archivée' });
    await toast.getByRole('button', { name: 'Annuler' }).click();
    await expect(findStepBadge(page)).toHaveText('À traiter');
    await findMoreActions(page).click();
    await page.getByRole('menuitem', { name: 'Archiver' }).click();
    await expect(findStepBadge(page)).toHaveText('À traiter · archivée');
    await page.getByRole('button', { name: 'Désarchiver' }).click();
    await expect(findStepBadge(page)).toHaveText('À traiter');
  });
});

test.describe('the tabs of the Posting page', () => {
  test('live in the URL, so that a link and Back open them again', async ({ page, openPage }) => {
    await openPage(`/postings/${BETHUNE_REFERENCE}?tab=notes`);
    const tabList = page.getByRole('tab');
    await expect(tabList).toHaveText(['Offre', /^Recherche/, /^Lettre de motivation/, 'Entretiens', 'Notes']);
    await expect(page.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: /^Recherche/ }).click();

    await expect(page).toHaveURL(/\?tab=research$/);
    await expect(page.getByRole('region', { name: 'Recherche' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'Recherche' })).toHaveCount(0);
  });

  test('show the Job Description beside the Deadline, Start Date and contacts', async ({ page, openPage }) => {
    await openPage(`/postings/${BETHUNE_REFERENCE}`);

    await expect(page.getByRole('tab', { name: 'Offre' })).toHaveAttribute('aria-selected', 'true');
    const facts = page.getByRole('region', { name: 'Repères' });
    await expect(facts.getByRole('definition')).toHaveText(['20/11/2026', '30/12/2026', '20/10/2026', /2026-2445600/]);
    await expect(page.getByRole('region', { name: 'Contacts' }).getByRole('listitem')).toHaveText([
      'p.tj-bethune@justice.fr',
      'Madame Odile SIMART, présidente du Tribunal Judiciaire de Béthune',
      'secrétariat en copie : sec.p.tj-bethune@justice.fr',
    ]);
    await expect(
      page
        .getByRole('region', { name: 'Fiche de poste' })
        .getByText('La présente fiche de poste concerne une affectation auprès du tribunal pour enfants.'),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Republication' })).toHaveCount(0);
  });

  test('tell a Repost and link it to the Posting it publishes again, and back', async ({ page, openPage }) => {
    await openPage(`/postings/${REPOST_REFERENCE}`);
    const repost = page.getByRole('region', { name: 'Republication' });
    await expect(repost).toContainText(/Publiée 2 fois depuis le \d\d\/\d\d\/2026/);

    await repost.getByRole('link', { name: `Offre précédente : ${REFERENCE}` }).click();

    await expect(page).toHaveURL(new RegExp(`/postings/${REFERENCE}$`));
    await page
      .getByRole('region', { name: 'Republication' })
      .getByRole('link', { name: `Republiée en ${REPOST_REFERENCE}` })
      .click();
    await expect(page).toHaveURL(new RegExp(`/postings/${REPOST_REFERENCE}$`));
    await findMoreActions(page).click();
    await expect(page.getByRole('menuitem', { name: `Offre précédente : ${REFERENCE}` })).toBeVisible();
  });

  test('keep Notes on a Posting, found again after a reload', async ({ page, openPage }) => {
    const front = { page, openPage };
    const notes = '# Appel du greffe\n\nRappeler **lundi** la greffière en chef.\n';
    const reference = await openJourney(front, 'notes', { path: 'notes', form: { notes: '' } });
    await front.openPage(`/postings/${reference}?tab=notes`);
    const editor = page.getByRole('textbox', { name: 'Notes en Markdown' });

    await editor.fill(notes);
    await expect(page.getByText('Modifications non enregistrées')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer les Notes' }).click();

    await expect(page.getByText('Notes enregistrées')).toBeVisible();
    await expect(page.getByText('Modifications non enregistrées')).toBeHidden();
    await page.reload();
    await expect(editor).toHaveValue(notes);
  });
});

test('reads the latest Version of an Artifact, and any other from its Version Select', async ({ page, openPage }) => {
  await openPage(`/postings/${BETHUNE_REFERENCE}?tab=research`);

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
