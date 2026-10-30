import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod/v4';

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

// Each test changes the Notification Channel of a Candidate of its own (test/seed-front.ts), and
// passes whatever an earlier run left there
async function openNotificationsOf(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Candidat' }).selectOption(name);
  await page.getByRole('button', { name: 'Choisir' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Offres de ${name}`);
  await page.getByRole('link', { name: 'Profil', exact: true }).click();
  const notifications = page.getByRole('region', { name: 'Notifications' });
  // Disabled until React hydrates: a click before would go nowhere
  await expect(notifications.getByRole('button', { name: 'Tester le Canal' })).toBeEnabled();
  await notifications.getByRole('combobox', { name: 'Canal de notification' }).selectOption('Home Assistant');
  return notifications;
}

// The generic form of the family, built from the descriptor of the module home-assistant (ADR-0010)
test.describe('Notification Channel of a Candidate', () => {
  test('tests, lists, saves and notifies through Home Assistant, and never sends the token back', async ({ page }) => {
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
    const notifications = await openNotificationsOf(page, 'Zoé');

    await notifications.getByRole('textbox', { name: 'Adresse de Home Assistant' }).fill(homeAssistantUrl);
    await notifications.getByLabel(/^Jeton d’accès longue durée/).fill(homeAssistantToken);
    await notifications.getByRole('button', { name: 'Tester le Canal' }).click();
    await expect(notifications.getByRole('status')).toHaveText('Le Canal de notification répond.');
    await notifications.getByRole('button', { name: 'Recharger les choix de Service de notification' }).click();
    const service = notifications.getByRole('combobox', { name: 'Service de notification' });
    await expect(service.getByRole('option')).toHaveText([
      'Choisir',
      'notify.mobile_app_iphone_de_lea',
      'notify.mobile_app_pixel_de_camille',
      'notify.mobile_app_iphone_de_sacha',
    ]);
    await service.selectOption('notify.mobile_app_pixel_de_camille');
    await notifications.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(notifications.getByText('Canal de notification enregistré.')).toBeVisible();
    await expect(notifications.getByText('configuré ✓')).toBeVisible();
    await expect(notifications.getByLabel(/^Jeton d’accès longue durée/)).toHaveValue('');

    const { length: receivedCount } = await readZoeNotifications(page);
    await notifications.getByRole('button', { name: 'Envoyer une notification de test' }).click();
    await expect(notifications.getByText('Notification de test envoyée')).toBeVisible();
    const receivedList = await readZoeNotifications(page);
    expect(receivedList.slice(receivedCount)).toEqual([
      {
        service: 'mobile_app_pixel_de_camille',
        title: 'Notification de test',
        message: 'Le Canal de notification de Zoé fonctionne.',
      },
    ]);

    await page.reload();
    await expect(page.locator('html')).not.toContainText(homeAssistantToken);
    expect(await page.content()).not.toContain(homeAssistantToken);
    const loaderData = await page.request.get('/profile.data');
    const loaderText = await loaderData.text();
    expect(loaderText).toContain('configuredSecretList');
    expect(loaderText).not.toContain(homeAssistantToken);
    expect(responseList.filter((body) => body.includes(homeAssistantToken))).toEqual([]);

    // Saved again with the token field left empty: the saved token still reaches Home Assistant
    await expect(notifications.getByText('configuré ✓')).toBeVisible();
    await expect(service).toHaveValue('notify.mobile_app_pixel_de_camille');
    await expect(notifications.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
    await notifications.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(notifications.getByText('Canal de notification enregistré.')).toBeVisible();
    await notifications.getByRole('button', { name: 'Tester le Canal' }).click();
    await expect(notifications.getByText('Le Canal de notification répond.')).toBeVisible();
    await expect(notifications.getByText('configuré ✓')).toBeVisible();
  });

  test('says Home Assistant refused a wrong token, and saves nothing', async ({ page }) => {
    const { homeAssistantUrl } = readFakeHomeAssistant();
    const notifications = await openNotificationsOf(page, 'Yanis');
    // No test saves Yanis's Channel; compared to what it was, so a run cut short leaves nothing to undo
    const address = notifications.getByRole('textbox', { name: 'Adresse de Home Assistant' });
    const savedAddress = await address.inputValue();
    const configuredCount = await notifications.getByText('configuré ✓').count();

    await address.fill(homeAssistantUrl);
    await notifications.getByLabel(/^Jeton d’accès longue durée/).fill('jeton-révoqué');
    await notifications.getByRole('button', { name: 'Tester le Canal' }).click();
    await expect(notifications.getByRole('alert')).toContainText('Home Assistant a refusé le jeton (HTTP 401)');

    await page.reload();
    await expect(address).toHaveValue(savedAddress);
    await expect(notifications.getByText('configuré ✓')).toHaveCount(configuredCount);
  });
});
