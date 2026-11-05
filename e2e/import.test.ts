import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from './candidate.ts';

// The fake Claude of test/e2e-actions.server.ts extracts this Job Description, in Grenoble
const JOB_DESCRIPTION = readFileSync(
  path.join(import.meta.dirname, '..', 'test', 'fixtures', 'import', 'greffier-grenoble.md'),
  'utf8',
);
const TITLE = 'Greffier placé – Tribunal judiciaire de Grenoble';

const FILE_NAME = 'greffier-grenoble.md';

// The worker takes the extraction, then the Research, each session lasting a second, and the Posting page
// reads the state again every two seconds
const READY_TIMEOUT_MS = 15_000;

// Hugo and Lina, whose Postings these tests alone add (test/seed-front.ts): until the worker reads its
// city, an imported Posting has no point on the map, which another test would see on Léa's
test('imports a Job Description dropped from the header: To Apply at once, then the worker reads its fields and runs its Research', async ({
  page,
  asCandidate,
  openPage,
}) => {
  // The tiles of the map come from OpenStreetMap over the internet: its points show without them
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await asCandidate('hugo');
  await openPage('/');
  await page.getByRole('button', { name: 'Importer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Importer une Fiche de poste' });

  const dataTransfer = await page.evaluateHandle(
    ({ fileName, markdown }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([markdown], fileName, { type: 'text/markdown' }));
      return transfer;
    },
    { fileName: FILE_NAME, markdown: JOB_DESCRIPTION },
  );
  await dialog.getByText('Dépose un fichier ici').dispatchEvent('drop', { dataTransfer });
  await expect(dialog.getByRole('textbox', { name: 'Texte de la Fiche de poste' })).toHaveValue(JOB_DESCRIPTION);
  await dialog.getByRole('button', { name: 'Importer' }).click();

  await expect(dialog).toBeHidden();
  // Named after its file until Claude has read its title
  const notifications = page.getByRole('region', { name: 'Notifications alt+T' });
  await expect(notifications).toContainText(new RegExp(`Offre importée\\s: ${FILE_NAME}`));
  await notifications.getByRole('button', { name: 'Voir dans À traiter' }).click();
  await expect(page).toHaveURL(/\/to-apply$/);

  // Its file's name or already its title, whichever the worker has reached
  const name = new RegExp(`${FILE_NAME}|${TITLE}`);
  await page
    .getByRole('complementary')
    .getByRole('listitem')
    .filter({ hasText: name })
    .getByRole('link', { name })
    .click();
  const extraction = page.getByRole('form', { name: 'Champs relevés par Claude' });
  await expect(extraction.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
  await page.getByRole('tab', { name: /^Recherche/ }).click();
  await expect(page.getByRole('region', { name: 'Recherche' }).getByRole('combobox', { name: 'Version' })).toHaveText(
    'Version 1 · Brouillon',
    { timeout: READY_TIMEOUT_MS },
  );

  await page.goto('/to-apply');
  // Located in Grenoble by API Géo's recorded answer, with its Deadline read by Claude
  const row = page.getByRole('listitem').filter({ hasText: TITLE });
  await expect(row).toHaveText(/^Grenoble/);
  await expect(row).toContainText('15 déc.');
  await expect(
    page.getByRole('region', { name: 'Carte des Offres' }).getByRole('button', { name: `Grenoble · ${TITLE}` }),
  ).toHaveCount(1);
});

test('imports a pasted Job Description: it skips New for To Apply, its name that of a paste until its title is read', async ({
  page,
  asCandidate,
  openPage,
}) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await asCandidate('lina');
  await openPage('/');
  await page.getByRole('button', { name: 'Importer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Importer une Fiche de poste' });
  await expect(dialog.getByRole('button', { name: 'Importer' })).toBeDisabled();

  // A text of its own: its reference hashes it, and another Candidate's Posting may not share it
  await dialog.getByRole('textbox', { name: 'Texte de la Fiche de poste' }).fill(`${JOB_DESCRIPTION}\n<!-- pasted -->`);
  await dialog.getByRole('button', { name: 'Importer' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('region', { name: 'Notifications alt+T' })).toContainText(
    /Offre importée\s: Fiche de poste collée/,
  );
  await expect(page.locator('main')).not.toContainText('Fiche de poste collée');

  await openPage('/to-apply');
  // Under either name: the worker may have read its title already
  await expect(
    page.getByRole('listitem').filter({ hasText: new RegExp(`Fiche de poste collée|${TITLE}`) }),
  ).toBeVisible();
});
