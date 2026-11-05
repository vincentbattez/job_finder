import type { Page } from '@playwright/test';
import { z } from 'zod/v4';

import { expect, switchCandidate, test } from './candidate.ts';

// Where the fake Home Assistant of playwright.config.ts listens, and the only token it accepts
function readFakeHomeAssistant() {
  return z.object({ homeAssistantUrl: z.string(), homeAssistantToken: z.string() }).parse(test.info().config.metadata);
}

const RECEIVED_NOTIFICATION_LIST_SCHEMA = z.array(
  z.object({ service: z.string(), title: z.string(), message: z.string() }),
);

// The test notifications the fake Home Assistant of playwright.config.ts received for Zoé: the other
// tests notify it at the same time
async function readZoeNotifications(page: Page) {
  const response = await page.request.get(`${readFakeHomeAssistant().homeAssistantUrl}/fake/notifications`);
  return RECEIVED_NOTIFICATION_LIST_SCHEMA.parse(await response.json()).filter(({ message }) =>
    message.includes('de Zoé'),
  );
}

// The toast a mutation ends in (DESIGN.md « Feedback »)
function toastOf(page: Page, text: string | RegExp) {
  return page.locator('[data-sonner-toast]').filter({ hasText: text });
}

// The Notification Channel, the generic form of its family built from the descriptor of the module
// home-assistant (ADR-0010). Each test changes the Channel of a Candidate of its own
// (test/seed-front.ts), and passes whatever an earlier run left there.
test.describe('Notification Channel of a Candidate', () => {
  test('tests, lists, saves and notifies through Home Assistant, and never sends the token back', async ({
    page,
    asCandidate,
    openPage,
  }) => {
    const { homeAssistantUrl, homeAssistantToken } = readFakeHomeAssistant();
    // Everything the server answers the page: its loaders and its fetchers
    const responseList: string[] = [];
    page.on('response', async (response) => {
      try {
        responseList.push(await response.text());
      } catch {
        // A redirect has no body to read
      }
    });
    await asCandidate('zoe');
    await openPage('/settings');
    const notifications = page.getByRole('region', { name: 'Notifications', exact: true });
    await notifications.getByRole('combobox', { name: 'Canal de notification' }).selectOption('Home Assistant');

    await notifications.getByRole('textbox', { name: 'Adresse de Home Assistant' }).fill(homeAssistantUrl);
    await notifications.getByLabel(/^Jeton d’accès longue durée/).fill(homeAssistantToken);
    await notifications.getByRole('button', { name: 'Tester le Canal' }).click();
    await expect(toastOf(page, 'Le Canal de notification répond.')).toBeVisible();
    await notifications.getByRole('button', { name: 'Recharger les choix de Service de notification' }).click();
    await expect(toastOf(page, '3 choix trouvés.')).toBeVisible();
    const service = notifications.getByRole('combobox', { name: 'Service de notification' });
    await expect(service.getByRole('option')).toHaveText([
      'Choisir',
      'notify.mobile_app_iphone_de_lea',
      'notify.mobile_app_pixel_de_camille',
      'notify.mobile_app_iphone_de_sacha',
    ]);
    await service.selectOption('notify.mobile_app_pixel_de_camille');
    await notifications.getByRole('button', { name: 'Enregistrer le Canal' }).click();
    await expect(toastOf(page, 'Canal de notification enregistré.')).toBeVisible();
    await expect(notifications.getByText('configuré')).toBeVisible();
    await expect(notifications.getByLabel(/^Jeton d’accès longue durée/)).toHaveValue('');

    const { length: receivedCount } = await readZoeNotifications(page);
    await notifications.getByRole('button', { name: 'Envoyer une notification de test' }).click();
    await expect(toastOf(page, 'Notification de test envoyée')).toBeVisible();
    const receivedList = await readZoeNotifications(page);
    expect(receivedList.slice(receivedCount)).toEqual([
      {
        service: 'mobile_app_pixel_de_camille',
        title: 'Notification de test',
        message: 'Le Canal de notification de Zoé fonctionne.',
      },
    ]);

    await openPage('/settings');
    expect(await page.content()).not.toContain(homeAssistantToken);
    const loaderData = await page.request.get('/settings.data');
    const loaderText = await loaderData.text();
    expect(loaderText).toContain('configuredSecretList');
    expect(loaderText).not.toContain(homeAssistantToken);
    expect(responseList.filter((body) => body.includes(homeAssistantToken))).toEqual([]);

    // Saved again with the token field left empty: the saved token still reaches Home Assistant
    await expect(notifications.getByText('configuré')).toBeVisible();
    await expect(service).toHaveValue('notify.mobile_app_pixel_de_camille');
    await notifications.getByRole('button', { name: 'Enregistrer le Canal' }).click();
    await expect(toastOf(page, 'Canal de notification enregistré.')).toBeVisible();
    await notifications.getByRole('button', { name: 'Tester le Canal' }).click();
    await expect(toastOf(page, 'Le Canal de notification répond.')).toBeVisible();
  });

  test('says Home Assistant refused a wrong token, and saves nothing', async ({ page, asCandidate, openPage }) => {
    const { homeAssistantUrl } = readFakeHomeAssistant();
    await asCandidate('yanis');
    await openPage('/settings');
    const notifications = page.getByRole('region', { name: 'Notifications', exact: true });
    await notifications.getByRole('combobox', { name: 'Canal de notification' }).selectOption('Home Assistant');
    // No test saves Yanis's Channel; compared to what it was, so a run cut short leaves nothing to undo
    const address = notifications.getByRole('textbox', { name: 'Adresse de Home Assistant' });
    const savedAddress = await address.inputValue();

    await address.fill(homeAssistantUrl);
    await notifications.getByLabel(/^Jeton d’accès longue durée/).fill('jeton-révoqué');
    await notifications.getByRole('button', { name: 'Tester le Canal' }).click();
    await expect(toastOf(page, 'Home Assistant a refusé le jeton (HTTP 401)')).toBeVisible();

    await openPage('/settings');
    await expect(address).toHaveValue(savedAddress);
  });
});

// Any visitor of the front creates or renames a Candidate, and sets the Default Deadline Period (ADR-0011)
// Counts on <body> each toast ever shown: Sonner takes one out of the page after a few seconds, so what
// the page holds at one instant does not tell how many there were
const COUNT_TOASTS_SCRIPT = `
  let count = 0;
  new MutationObserver((recordList) => {
    for (const { addedNodes } of recordList) {
      for (const node of addedNodes) {
        if (node instanceof Element) {
          count += node.matches('[data-sonner-toast]') ? 1 : node.querySelectorAll('[data-sonner-toast]').length;
        }
      }
    }
    document.body.dataset.toastCount = String(count);
  }).observe(document.body, { childList: true, subtree: true });
`;

test.describe('Candidates and the Default Deadline Period', () => {
  test('creates a Candidate, who joins the switcher, then renames them', async ({ page, openPage }) => {
    // A Candidate of its own on each run, since none is ever deleted
    const suffix = `${String(Date.now())}-${String(test.info().repeatEachIndex)}`;
    const id = `ambre-${suffix}`;
    await openPage('/');
    await page.getByRole('button', { name: 'Changer de Candidat' }).click();
    await page.getByRole('menuitem', { name: 'Gérer les Candidats' }).click();
    await expect(page).toHaveURL('/settings#candidates');
    const candidates = page.getByRole('region', { name: 'Candidats' });

    await candidates.getByRole('textbox', { name: 'Nom', exact: true }).fill(`Ambre ${suffix}`);
    await candidates.getByRole('textbox', { name: /^Identifiant/ }).fill(id);
    await candidates.getByRole('button', { name: 'Créer le Candidat' }).click();
    await expect(toastOf(page, 'Candidat créé.')).toBeVisible();
    // The form starts blank again, for the next one
    await expect(candidates.getByRole('textbox', { name: 'Nom', exact: true })).toHaveValue('');

    const nameBox = candidates.getByRole('textbox', { name: `Nom de ${id}` });
    await expect(nameBox).toHaveValue(`Ambre ${suffix}`);
    await nameBox.fill(`Ambre Martin ${suffix}`);
    await candidates.getByRole('button', { name: `Renommer ${id}` }).click();
    await expect(toastOf(page, 'Candidat renommé.')).toBeVisible();
    await expect(nameBox).toHaveValue(`Ambre Martin ${suffix}`);
    await switchCandidate(page, `Ambre Martin ${suffix}`);
    await expect(page.getByRole('button', { name: 'Changer de Candidat' })).toContainText(`Ambre Martin ${suffix}`);
  });

  test('refuses an identifier another Candidate has, and keeps what was typed', async ({ page, openPage }) => {
    await openPage('/settings');
    const candidates = page.getByRole('region', { name: 'Candidats' });

    await candidates.getByRole('textbox', { name: 'Nom', exact: true }).fill('Léa bis');
    await candidates.getByRole('textbox', { name: /^Identifiant/ }).fill('lea');
    await candidates.getByRole('button', { name: 'Créer le Candidat' }).click();

    // Its words hold the narrow no-break space French puts before a colon
    await expect(toastOf(page, /Un Candidat a déjà l'identifiant lea\s:/)).toBeVisible();
    await expect(candidates.getByRole('textbox', { name: 'Nom', exact: true })).toHaveValue('Léa bis');
  });

  // Saved as it was: the other tests read Expired at the same time
  test('saves the Default Deadline Period', async ({ page, openPage }) => {
    await openPage('/settings');
    const period = page.getByRole('region', { name: 'Délai par défaut' });

    await period.getByRole('spinbutton', { name: 'Délai par défaut, en mois' }).fill('6');
    await period.getByRole('button', { name: 'Enregistrer le Délai par défaut' }).click();

    await expect(toastOf(page, 'Délai par défaut enregistré.')).toBeVisible();
    await openPage('/settings');
    await expect(period.getByRole('spinbutton', { name: 'Délai par défaut, en mois' })).toHaveValue('6');
  });

  // On a slow machine React skips the renders of a mutation: each save still has to end in its toast
  test('tells every save in a toast, on a slow machine too', async ({ page, openPage }) => {
    await openPage('/settings');
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    await page.evaluate(COUNT_TOASTS_SCRIPT);
    const save = page.getByRole('button', { name: 'Enregistrer le Délai par défaut' });

    for (const count of [1, 2, 3]) {
      await save.click();
      await expect(page.locator('body')).toHaveAttribute('data-toast-count', String(count));
    }
  });
});
