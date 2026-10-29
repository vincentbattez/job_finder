import { expect, test } from '@playwright/test';

// An Offre that test/seed-front.ts leaves without any Artefact and that no other test touches: the
// test produces its Recherche first. The e2e worker runs the jobs with the fake Claude, whose
// sessions last a second (test/e2e-actions.server.ts).
const REFERENCE = '2026-2416437';

// The worker takes the job, then its session lasts a second, and the fiche reads the état again
// every two seconds
const READY_TIMEOUT_MS = 15_000;

// The Fiche the fake Claude writes, its « [à compléter : …] » filled in by the Candidat
const CORRECTED_FICHE = `# Fiche d’entretien factice

## À réviser

- Les missions du poste.

## Moyens mnémotechniques

- « MPS » : Missions, Partenaires, Service.

## Présentez-vous

Titulaire d’un master 2 de droit privé, je souhaite rejoindre votre juridiction.

## Questions probables

- Pourquoi ce poste ?
`;

test('launches the Fiche d’entretien once the Offre has a Recherche retenue, then corrects it', async ({ page }) => {
  await page.goto(`/offres/${REFERENCE}`);
  const recherche = page.getByRole('region', { name: 'Recherche' });
  const fiche = page.getByRole('region', { name: 'Fiche d’entretien' });
  await expect(fiche).toContainText(`L'Offre ${REFERENCE} n'a pas de Recherche retenue`);
  await expect(fiche.getByRole('button', { name: 'Lancer la Fiche d’entretien' })).toBeDisabled();
  await recherche.getByRole('button', { name: 'Lancer la Recherche' }).click();
  await expect(recherche.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });

  await fiche.getByRole('button', { name: 'Lancer la Fiche d’entretien' }).click();

  await expect(fiche.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
  await expect(fiche.locator('summary')).toHaveText([/^v1\s*Prêt\s*Retenue/]);
  await expect(fiche.getByText(`jf edit ${REFERENCE} fiche_entretien`)).toBeVisible();
  const document = fiche.getByRole('figure', { name: 'fiche-entretien.md' });
  const editor = document.getByRole('textbox', { name: 'Markdown' });
  await expect(document.locator('mark')).toHaveText(['[à compléter : diplôme]']);
  await editor.fill(CORRECTED_FICHE);
  await expect(document.getByText('Modifications non enregistrées')).toBeVisible();
  await document.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(document.getByText('Modifications non enregistrées')).toBeHidden();
  await page.reload();
  await expect(editor).toHaveValue(CORRECTED_FICHE);
  await expect(fiche.locator('summary')).toHaveText([/^v1\s*Prêt\s*Retenue/]);
});
