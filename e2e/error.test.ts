import { expect, test } from '@playwright/test';

// These tests change no data: each failure leaves the Béthune Posting as test/seed-front.ts made it,
// its Research v1 chosen and v2 ready
const BETHUNE_REFERENCE = '2026-2445600';

test('says when a page does not exist', async ({ page }) => {
  await page.goto('/page-inconnue');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page introuvable');
});

// A failing loader says what failed and what to do, rather than only that the page failed
test('shows the message of a loader that fails', async ({ page }) => {
  await page.goto('/postings/2000-0000000');

  await expect(page.getByRole('main')).toContainText(
    'Offre inconnue : 2000-0000000. « jf list <candidat> » liste les Offres.',
  );
});

// A refusal goes back to the button that was clicked: the page stays, with the code's message
test('refuses an unknown Version next to its button, without an error page', async ({ page }) => {
  await page.goto(`/postings/${BETHUNE_REFERENCE}`);
  const research = page.getByRole('region', { name: 'Recherche' });
  const version = research.locator('li > details').filter({ has: page.locator('summary', { hasText: /^v2/ }) });
  await version.locator('summary', { hasText: /^v2/ }).click();
  const chooseButton = version.getByRole('button', { name: 'Retenir cette Version' });
  await expect(chooseButton).toBeEnabled();
  // As if v2 had gone since the page was shown: set in the data the form posts, which no render puts back
  await chooseButton.evaluate((button: HTMLButtonElement) => {
    button.form?.addEventListener('formdata', (event) => {
      event.formData.set('number', '99');
    });
  });

  await chooseButton.click();

  await expect(version.getByRole('alert')).toHaveText(/^Version inconnue : research v99 de l'Offre 2026-2445600\./);
  await expect(page.getByText('Cette page n’a pas pu s’afficher')).toHaveCount(0);
  await expect(research.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Retenue/, /^v2\s*Prêt/]);
});

test('keeps the text typed when saving a document fails', async ({ page }) => {
  await page.goto(`/postings/${BETHUNE_REFERENCE}`);
  const document = page.getByRole('region', { name: 'Recherche' }).getByRole('figure', { name: 'research.md' });
  const textbox = document.getByRole('textbox', { name: 'Markdown' });
  // React resets a textarea it takes over: typing waits for it to be editable
  await expect(textbox).toBeEditable();
  await textbox.fill('# Recherche corrigée\n');
  // As if the file had been renamed since the page was shown: set in the data the form posts, which no
  // render puts back
  await document.locator('input[name="fileName"]').evaluate((input: HTMLInputElement) => {
    input.form?.addEventListener('formdata', (event) => {
      event.formData.set('fileName', 'renamed.md');
    });
  });

  await document.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(document.getByRole('alert')).toHaveText(
    "« renamed.md » n'est pas un fichier de la Version retenue de research de l'Offre 2026-2445600.",
  );
  await expect(textbox).toHaveValue('# Recherche corrigée\n');
});
