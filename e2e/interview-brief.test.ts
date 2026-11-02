import { expect, test } from '@playwright/test';

import { generate } from './generation.ts';
import { prepareInterview } from './interview.ts';
import { findOverflowing } from './overflow.ts';
import { unfoldLatestVersion } from './version.ts';

// A Posting that test/seed-front.ts leaves without any Artifact and that no other test touches: the
// test marks it Applied, gives it an Interview and produces its Research first. The e2e worker runs
// the jobs with the fake Claude, whose sessions last a second (test/e2e-actions.server.ts).
const REFERENCE = '2026-2416437';

// The worker takes the job, then its session lasts a second, and the Posting page reads the state again
// every two seconds
const READY_TIMEOUT_MS = 15_000;

// The Interview Brief the fake Claude writes, its « [à compléter : …] » filled in by the Candidate
const CORRECTED_BRIEF = `# Fiche d’entretien factice

## À réviser

- Les missions du poste.

## Moyens mnémotechniques

- « MPS » : Missions, Partenaires, Service.

## Présentez-vous

Titulaire d’un master 2 de droit privé, je souhaite rejoindre votre juridiction.

## Questions probables

- Pourquoi ce poste ?
`;

test('launches the Interview Brief of an Interview once the Posting has a Chosen Research, then corrects it', async ({
  page,
}) => {
  const interview = await prepareInterview(page, REFERENCE);
  const research = page.getByRole('region', { name: 'Recherche' });
  // Under its Interview, beside the Interview's facts
  const brief = interview.getByRole('region', { name: 'Fiche d’entretien' });
  await expect(brief).toContainText(`L'Offre ${REFERENCE} n'a pas de Recherche validée`);
  await page.getByRole('tab', { name: /^Recherche/ }).click();
  await generate(page, research);
  await expect(research.getByRole('combobox', { name: 'Version' })).toHaveText('Version 1 · Brouillon', {
    timeout: READY_TIMEOUT_MS,
  });
  // Only a Validated Research is read by the Interview Brief
  await research.getByRole('button', { name: 'Valider la Version 1' }).click();
  await expect(page.getByRole('tab', { name: 'Recherche (Validée)' })).toBeVisible();
  await page.getByRole('tab', { name: /^Entretiens/ }).click();

  await generate(page, brief);

  await expect(brief.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Brouillon/], {
    timeout: READY_TIMEOUT_MS,
  });
  await unfoldLatestVersion(brief);
  await brief.getByRole('button', { name: 'Valider la Version 1' }).click();
  await expect(brief.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Validée · retenue/]);
  await expect(brief.getByText(`jf edit ${REFERENCE} interview_brief 1`)).toBeVisible();
  const document = brief.getByRole('figure', { name: 'interview-brief.md' });
  const editor = document.getByRole('textbox', { name: 'Markdown' });
  await expect(document.locator('mark')).toHaveText(['[à compléter : diplôme]']);
  await editor.fill(CORRECTED_BRIEF);
  await expect(document.getByText('Modifications non enregistrées')).toBeVisible();
  await document.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(document.getByText('Modifications non enregistrées')).toBeHidden();
  await page.reload();
  await unfoldLatestVersion(brief);
  await expect(editor).toHaveValue(CORRECTED_BRIEF);
  await expect(brief.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Validée · retenue/]);
  // Under its Interview, the Interview Brief still fits a phone screen
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => findOverflowing(page)).toEqual([]);
});
