import { expect, test } from './candidate.ts';

// These tests change no data: each failure leaves the Béthune Posting as test/seed-front.ts made it,
// its Research v1 chosen and v2 a Draft
const BETHUNE_REFERENCE = '2026-2445600';

test('says when a page does not exist', async ({ page }) => {
  await page.goto('/page-inconnue');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page introuvable');
});

// A failing loader says what failed and what to do, under its code, rather than only that the page failed
test('shows the message and the code of a loader that fails', async ({ page }) => {
  await page.goto('/postings/2000-0000000');

  await expect(page.getByRole('alert')).toHaveText(
    'Offre inconnue : 2000-0000000. « jf list <candidat> » liste les Offres.',
  );
  await expect(page.getByRole('main')).toContainText('Code d’erreur : unknown_posting');
});

// A refusal comes back as the toast of the button that was clicked: the page stays, with the code's message
test('refuses an unknown Version in a toast, without an error page', async ({ page, openPage }) => {
  await openPage(`/postings/${BETHUNE_REFERENCE}?tab=research`);
  const research = page.getByRole('region', { name: 'Recherche' });
  const validateButton = research.getByRole('button', { name: 'Valider la Version 2' });
  await expect(validateButton).toBeEnabled();
  // As if v2 had gone since the page was shown: set in the data the form posts, which no render puts back
  await validateButton.evaluate((button: HTMLButtonElement) => {
    button.form?.addEventListener('formdata', (event) => {
      event.formData.set('number', '99');
    });
  });

  await validateButton.click();

  await expect(page.getByText(/^Version inconnue : research v99 de l'Offre 2026-2445600\./)).toBeVisible();
  await expect(page.getByText('Cette page n’a pas pu s’afficher')).toHaveCount(0);
  await expect(research.getByRole('combobox', { name: 'Version' })).toHaveText('Version 2 · Brouillon');
});

test('keeps the text typed when saving a correction fails', async ({ page, openPage }) => {
  await openPage(`/postings/${BETHUNE_REFERENCE}?tab=research`);
  const research = page.getByRole('region', { name: 'Recherche' });
  await research.getByRole('button', { name: 'Modifier' }).click();
  const textbox = research.getByRole('textbox', { name: 'Texte de la Version 2' });
  // React resets a textarea it takes over: typing waits for it to be editable
  await expect(textbox).toBeEditable();
  await textbox.fill('# Recherche corrigée\n');
  // As if the file had been renamed since the page was shown: set in the data the form posts, which no
  // render puts back
  await research.locator('input[name="fileName"]').evaluate((input: HTMLInputElement) => {
    input.form?.addEventListener('formdata', (event) => {
      event.formData.set('fileName', 'renamed.md');
    });
  });

  await research.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(
    page.getByText("« renamed.md » n'est pas un fichier modifiable d'une Version de research de l'Offre 2026-2445600."),
  ).toBeVisible();
  await expect(textbox).toContainText('Recherche corrigée');
});
