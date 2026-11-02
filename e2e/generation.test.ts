import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod/v4';

import { expect, test } from './candidate.ts';
import { goToRecap, openGeneration } from './generation.ts';

// Vera's one Posting, which test/seed-front.ts imports with a Validated Research and no other test touches;
// the import names it from its Markdown (src/modules/source-import)
const VERA_JOB_DESCRIPTION = '# Greffier – Valence\n\nTenir les audiences du tribunal judiciaire de Valence.\n';
const REFERENCE = `import-${createHash('sha256').update(VERA_JOB_DESCRIPTION).digest('hex').slice(0, 10)}`;

// The worker takes the job, then its session lasts a second, and the Posting page reads the state again
// every two seconds
const READY_TIMEOUT_MS = 15_000;

const PAST_LETTER = 'Madame la Présidente,\n\nJe souhaite rejoindre le tribunal judiciaire de Lille.\n';
const ANNEX = '# Mémoire\n\nLa justice des mineurs.\n';

// Vera's Profile, written first as jf profile would: her CV and Facts, a past letter and an Annex
function writeVeraProfile(): void {
  const { dataDirectory } = z.object({ dataDirectory: z.string() }).parse(test.info().config.metadata);
  const profileDirectory = path.join(dataDirectory, 'candidates', 'vera', 'profile');
  rmSync(profileDirectory, { recursive: true, force: true });
  mkdirSync(profileDirectory, { recursive: true });
  writeFileSync(path.join(profileDirectory, 'cv.md'), '# CV de Vera\n\n- Master 2 droit privé\n');
  writeFileSync(path.join(profileDirectory, 'facts.md'), '# Faits\n\n## Mobilité\n\n- Drôme\n');
  writeFileSync(path.join(profileDirectory, 'letter-lille.md'), PAST_LETTER);
  writeFileSync(path.join(profileDirectory, 'annex-memoire.md'), ANNEX);
}

test('generates the Letter from the panel: Inputs checked, Prompt copied, run followed to its Draft', async ({
  page,
  context,
  asCandidate,
  openPage,
}) => {
  writeVeraProfile();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await asCandidate('vera');
  await openPage(`/postings/${REFERENCE}?tab=letter`);
  const letter = page.getByRole('region', { name: 'Lettre de motivation' });

  const panel = await openGeneration(page, letter);

  // Step 1: what Claude reads, the required Inputs locked, the past letter checked, the Annex to add
  await expect(panel.getByRole('heading', { level: 2 })).toHaveText(/^(?:Générer|Régénérer) la Lettre de motivation$/);
  await expect(panel.getByRole('img', { name: /^Toujours lu/ })).toHaveCount(4);
  const pastLetter = panel.getByRole('checkbox', { name: 'Lettre passée · letter-lille.md' });
  await expect(pastLetter).toBeChecked();
  await expect(panel.getByRole('button', { name: /^Annexe · annex-memoire\.md/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await panel.getByRole('button', { name: 'Aperçu : Lettre passée · letter-lille.md' }).click();
  await expect(panel.getByText('Je souhaite rejoindre le tribunal judiciaire de Lille.')).toBeVisible();
  await pastLetter.uncheck();

  // Step 3: the recap weighs the four Inputs left, and copies exactly what the session receives
  await goToRecap(panel);
  const breakdown = panel.getByRole('region', { name: 'Ce que Claude lit, par poids' });
  await expect(breakdown).toContainText('Total · 4 documents');
  await expect(breakdown).not.toContainText('Lettre passée');
  await panel.getByRole('button', { name: 'Copier le Prompt' }).click();
  await expect(page.getByText('Prompt copié')).toBeVisible();
  const prompt = await page.evaluate(() => globalThis.navigator.clipboard.readText());
  expect(prompt).toContain('Tenir les audiences du tribunal judiciaire de Valence.');
  expect(prompt).toContain('Recherche : le tribunal judiciaire de Valence');
  expect(prompt).not.toContain('tribunal judiciaire de Lille');

  // Launched, the panel follows the run to its Draft
  await panel.getByRole('button', { name: 'Lancer', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText(/Version \d+ prête, en Brouillon/, { timeout: READY_TIMEOUT_MS });
  await panel.getByRole('button', { name: 'Voir le Brouillon' }).click();
  await expect(panel).toBeHidden();
  await expect(letter.getByRole('combobox', { name: 'Version' })).toHaveText(/^Version \d+ · Brouillon$/);
  await expect(page.getByRole('tab', { name: 'Lettre de motivation (Brouillon)' })).toBeVisible();
});
