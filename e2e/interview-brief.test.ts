import { expect, test } from '@playwright/test';

// A Posting that test/seed-front.ts leaves without any Artifact and that no other test touches: the
// test produces its Research first. The e2e worker runs the jobs with the fake Claude, whose
// sessions last a second (test/e2e-actions.server.ts).
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

test('launches the Interview Brief once the Posting has a Chosen Research, then corrects it', async ({ page }) => {
  await page.goto(`/postings/${REFERENCE}`);
  const research = page.getByRole('region', { name: 'Recherche' });
  const brief = page.getByRole('region', { name: 'Fiche d’entretien' });
  await expect(brief).toContainText(`L'Offre ${REFERENCE} n'a pas de Recherche retenue`);
  await expect(brief.getByRole('button', { name: 'Lancer la Fiche d’entretien' })).toBeDisabled();
  await research.getByRole('button', { name: 'Lancer la Recherche' }).click();
  await expect(research.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });

  await brief.getByRole('button', { name: 'Lancer la Fiche d’entretien' }).click();

  await expect(brief.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
  await expect(brief.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Retenue/]);
  await expect(brief.getByText(`jf edit ${REFERENCE} interview_brief`)).toBeVisible();
  const document = brief.getByRole('figure', { name: 'interview-brief.md' });
  const editor = document.getByRole('textbox', { name: 'Markdown' });
  await expect(document.locator('mark')).toHaveText(['[à compléter : diplôme]']);
  await editor.fill(CORRECTED_BRIEF);
  await expect(document.getByText('Modifications non enregistrées')).toBeVisible();
  await document.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(document.getByText('Modifications non enregistrées')).toBeHidden();
  await page.reload();
  await expect(editor).toHaveValue(CORRECTED_BRIEF);
  await expect(brief.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Retenue/]);
});
