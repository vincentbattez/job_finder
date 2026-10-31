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

// Hugo's Postings, which this test alone adds (test/seed-front.ts): until the worker reads its city,
// an imported Posting has no point on the map, which another test would see on Léa's
const CANDIDATE_NAME = 'Hugo';

test('imports a Job Description dropped on the Postings: it shows at once, then the worker reads its fields and runs its Research', async ({
  page,
  asCandidate,
  openPage,
}) => {
  // The tiles of the map come from OpenStreetMap over the internet: its points show without them
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await asCandidate('hugo');
  await openPage('/postings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Offres de ${CANDIDATE_NAME}`);
  // The drop needs React, which enables the field once it runs
  await expect(page.getByLabel('Importer une Fiche de poste')).toBeEnabled();

  const dataTransfer = await page.evaluateHandle(
    ({ fileName, markdown }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([markdown], fileName, { type: 'text/markdown' }));
      return transfer;
    },
    { fileName: FILE_NAME, markdown: JOB_DESCRIPTION },
  );
  await page.getByText('Glissez ici une Fiche de poste en Markdown').dispatchEvent('drop', { dataTransfer });

  // Named after its file until Claude has read its title
  await expect(page.getByText(`Offre importée : ${FILE_NAME}`)).toBeVisible();
  await page
    .getByRole('row', { name: new RegExp(FILE_NAME) })
    .getByRole('link', { name: FILE_NAME })
    .click();
  const extraction = page.getByRole('form', { name: 'Champs relevés par Claude' });
  await expect(extraction.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
  await expect(page.getByRole('region', { name: 'Recherche' }).getByRole('status')).toHaveText('Prêt', {
    timeout: READY_TIMEOUT_MS,
  });

  await page.goto('/postings');
  const row = page.getByRole('row', { name: new RegExp(TITLE) });
  await expect(row.getByRole('cell').last()).toHaveText('15/12/2026');
  // Located in Grenoble by API Géo's recorded answer
  const point = page
    .getByRole('region', { name: 'Carte des Offres' })
    .getByRole('button', { name: new RegExp(`^${TITLE} · import-`) });
  await expect(point).toHaveAttribute('data-status', 'to_apply');
});
