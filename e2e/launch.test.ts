import { z } from 'zod/v4';

import { expect, test } from './candidate.ts';
import { goToRecap, openGeneration } from './generation.ts';
import { forgetResearch, runVersion } from './interview.ts';

// Each test launches modules on a Posting of its own, which test/seed-front.ts prepares: the data
// folder is shared by the whole run. The e2e worker runs the queued jobs with the fake Claude, whose
// sessions are short (test/e2e-actions.server.ts).
const FAILED_RESEARCH_REFERENCE = '2026-2412591';
const NOTIFICATION_FAILED_REFERENCE = '2026-2445609';

// The worker takes the job, its session runs, and the Posting page reads the state again
const READY_TIMEOUT_MS = 15_000;

const RECEIVED_NOTIFICATION_LIST_SCHEMA = z.array(
  z.object({ service: z.string(), title: z.string(), message: z.string() }),
);

test.describe('launching the modules of a Posting', () => {
  test.describe('a failed Research', () => {
    // Each starts from the seed's failed Version alone, on the Posting only they touch
    test.describe.configure({ mode: 'serial' });
    test.beforeEach(() => {
      forgetResearch(FAILED_RESEARCH_REFERENCE, 1);
    });

    test('relaunches from its panel closed meanwhile', async ({ page, openPage }) => {
      await openPage(`/postings/${FAILED_RESEARCH_REFERENCE}?tab=letter`);
      const research = page.getByRole('region', { name: 'Recherche' });
      const letter = page.getByRole('region', { name: 'Lettre de motivation' });
      // The refusal beside Generate, then among the blockers of the recap
      const refusal = `L'Offre ${FAILED_RESEARCH_REFERENCE} n'a pas de Recherche validée`;
      await expect(letter).toContainText(refusal);
      let panel = await openGeneration(page, letter);
      await expect(panel.getByRole('listitem').filter({ hasText: /^Recherche/ })).toContainText(
        'Pas encore de Version validée',
      );
      await goToRecap(panel);
      await expect(panel.getByRole('alert')).toContainText(refusal);
      await expect(panel.getByRole('button', { name: 'Lancer', exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: /^Recherche/ }).click();
      // The reason the fake worker's session gave, after the message of its code
      await expect(research.getByRole('alert')).toHaveText(
        'La session Claude Code a échoué : son journal dit pourquoi. Relancer le module.\nClaude Code a atteint la limite de son abonnement.',
      );

      panel = await openGeneration(page, research);
      await goToRecap(panel);
      await panel.getByRole('button', { name: 'Lancer', exact: true }).click();
      await panel.getByRole('button', { name: 'Fermer, la génération continue' }).click();

      // Closed, the panel lets the run go on; a toast offers its Draft once ready
      await expect(panel).toBeHidden();
      const toast = page.getByRole('region', { name: 'Notifications alt+T' });
      await expect(toast.getByText('Recherche : Version 2 prête, en Brouillon')).toBeVisible({
        timeout: READY_TIMEOUT_MS,
      });
      await toast.getByRole('button', { name: 'Voir le Brouillon' }).click();
      await expect(research.getByRole('alert')).toHaveCount(0);
      await expect(research.getByRole('combobox', { name: 'Version' })).toHaveText('Version 2 · Brouillon');
    });

    test('whose Draft, once validated, lets the Letter run', async ({ page, request, openPage }) => {
      await runVersion(page, { module: 'research', reference: FAILED_RESEARCH_REFERENCE, readyCount: 1 });
      await openPage(`/postings/${FAILED_RESEARCH_REFERENCE}?tab=research`);
      const research = page.getByRole('region', { name: 'Recherche' });
      const letter = page.getByRole('region', { name: 'Lettre de motivation' });
      const refusal = `L'Offre ${FAILED_RESEARCH_REFERENCE} n'a pas de Recherche validée`;
      await expect(research.getByRole('combobox', { name: 'Version' })).toHaveText('Version 2 · Brouillon');
      // A Draft is read by no other Artifact: the Letter waits for its validation
      await page.getByRole('tab', { name: /^Lettre de motivation/ }).click();
      await expect(letter).toContainText(refusal);
      await page.getByRole('tab', { name: /^Recherche/ }).click();
      await research.getByRole('button', { name: 'Valider la Version 2' }).click();
      await expect(page.getByRole('tab', { name: 'Recherche (Validée)' })).toBeVisible();
      await page.getByRole('tab', { name: /^Lettre de motivation/ }).click();
      await expect(letter).not.toContainText("n'a pas de Recherche validée");
      const panel = await openGeneration(page, letter);
      await goToRecap(panel);
      await expect(panel.getByRole('button', { name: 'Lancer', exact: true })).toBeEnabled();
      await page.keyboard.press('Escape');
      // The worker notifies Léa's phone through the fake Home Assistant once the Research is saved
      const { homeAssistantUrl } = z.object({ homeAssistantUrl: z.url() }).parse(test.info().config.metadata);
      await expect
        .poll(async () => {
          const response = await request.get(`${homeAssistantUrl}/fake/notifications`);
          return RECEIVED_NOTIFICATION_LIST_SCHEMA.parse(await response.json());
        })
        .toContainEqual({
          service: 'mobile_app_iphone_de_lea',
          title: 'Recherche prête',
          message:
            'ATTACHE(E) DE JUSTICE - affecté(e) auprès des magistrats du siège - TJ NARBONNE\nTRIBUNAL JUDICIAIRE DE NARBONNE',
        });
    });
  });

  // Read only: Léa was not warned her Research is ready, which the seed's refused token caused
  test('shows by a ready Research why its notification was not sent', async ({ page }) => {
    await page.goto(`/postings/${NOTIFICATION_FAILED_REFERENCE}?tab=research`);
    const research = page.getByRole('region', { name: 'Recherche' });

    await expect(research.getByRole('alert')).toContainText(
      `Notification « Recherche prête » de l'Offre ${NOTIFICATION_FAILED_REFERENCE} non envoyée : `,
    );
  });
});
