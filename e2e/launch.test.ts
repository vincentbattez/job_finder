import { expect, test } from '@playwright/test';
import { z } from 'zod/v4';

// Each test launches modules on a Posting of its own, which test/seed-front.ts prepares: the data
// folder is shared by the whole run. The e2e worker runs the queued jobs with the fake Claude, whose
// sessions last a second (test/e2e-actions.server.ts).
const LETTER_REFERENCE = '2026-2420931';
const FAILED_RESEARCH_REFERENCE = '2026-2412591';
const NOTIFICATION_FAILED_REFERENCE = '2026-2445609';

// The worker takes the job, then its session lasts a second, and the Posting page reads the state again
// every two seconds
const READY_TIMEOUT_MS = 15_000;

const RECEIVED_NOTIFICATION_LIST_SCHEMA = z.array(
  z.object({ service: z.string(), title: z.string(), message: z.string() }),
);

test.describe('launching the modules of a Posting', () => {
  test('launches the Letter, then shows it turn ready without a reload', async ({ page }) => {
    await page.goto(`/postings/${LETTER_REFERENCE}?tab=letter`);
    const letter = page.getByRole('region', { name: 'Lettre' });
    await expect(letter.getByRole('status')).toHaveText('Absent');

    await letter.getByRole('button', { name: 'Lancer la Lettre' }).click();

    // Queued until the worker takes the job, which its session then runs
    await expect(letter.getByRole('status')).toHaveText(/^(?:En attente|En cours)$/);
    await expect(letter.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
    await expect(letter.locator('li > details > summary')).toHaveText([/^v1\s*Prêt\s*Retenue/]);
    await expect(letter.locator('figcaption')).toHaveText(['draft.md', 'letter.md']);
    await expect(page.getByRole('tab', { name: 'Lettre de motivation (Prêt)' })).toBeVisible();
  });

  test('relaunches a failed Research, which lets the Letter run and notifies it ready', async ({ page, request }) => {
    await page.goto(`/postings/${FAILED_RESEARCH_REFERENCE}?tab=letter`);
    const research = page.getByRole('region', { name: 'Recherche' });
    const letter = page.getByRole('region', { name: 'Lettre' });
    await expect(letter).toContainText(`L'Offre ${FAILED_RESEARCH_REFERENCE} n'a pas de Recherche retenue`);
    await expect(letter.getByRole('button', { name: 'Lancer la Lettre' })).toBeDisabled();
    await page.getByRole('tab', { name: /^Recherche/ }).click();
    await expect(research.getByRole('status')).toHaveText('En échec');
    // The reason the fake worker's session gave, after the message of its code
    await expect(research.getByRole('alert')).toHaveText(
      'La session Claude Code a échoué : son journal dit pourquoi. Relancer le module.\nClaude Code a atteint la limite de son abonnement.',
    );

    await research.getByRole('button', { name: 'Relancer la Recherche' }).click();

    await expect(research.getByRole('status')).toHaveText('Prêt', { timeout: READY_TIMEOUT_MS });
    await expect(research.getByRole('alert')).toHaveCount(0);
    await expect(research.locator('li > details > summary')).toHaveText([/^v1\s*En échec/, /^v2\s*Prêt\s*Retenue/]);
    await page.getByRole('tab', { name: /^Lettre de motivation/ }).click();
    await expect(letter.getByRole('button', { name: 'Lancer la Lettre' })).toBeEnabled();
    await expect(letter).not.toContainText("n'a pas de Recherche retenue");
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

  // Read only: Léa was not warned her Research is ready, which the seed's refused token caused
  test('shows by a ready Research why its notification was not sent', async ({ page }) => {
    await page.goto(`/postings/${NOTIFICATION_FAILED_REFERENCE}?tab=research`);
    const research = page.getByRole('region', { name: 'Recherche' });

    await expect(research.getByRole('status')).toHaveText('Prêt');
    await expect(research.getByRole('alert')).toContainText(
      `Notification « Recherche prête » de l'Offre ${NOTIFICATION_FAILED_REFERENCE} non envoyée : `,
    );
  });

  // Read only, on the Posting whose Research is ready: the Letter's Prompt reads it
  test('unfolds beside the Letter the Prompt its launch would run, which links to the Research it reads', async ({
    page,
  }) => {
    await page.goto(`/postings/${NOTIFICATION_FAILED_REFERENCE}?tab=letter`);
    const letter = page.getByRole('region', { name: 'Lettre' });
    const prompt = letter.locator('details', { has: page.locator('summary', { hasText: /^Prompt$/ }) });

    await prompt.locator('summary').click();

    await expect(prompt.getByRole('heading')).toHaveText(['Partie fixe', 'Consignes', 'Artefacts que lit ce Prompt']);
    await expect(prompt.locator('pre').first()).toContainText('`letter/v<next>/draft.md`');
    await prompt.getByRole('link', { name: `${NOTIFICATION_FAILED_REFERENCE} · Recherche v1` }).click();
    await expect(page).toHaveURL(new RegExp(`/postings/${NOTIFICATION_FAILED_REFERENCE}\\?tab=research$`));
    await expect(page.getByRole('region', { name: 'Recherche' })).toBeVisible();
  });
});
