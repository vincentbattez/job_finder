import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { startFakeHomeAssistant } from './fake-home-assistant.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

const LEA_SERVICE = 'notify.mobile_app_iphone_de_lea';
const CAMILLE_SERVICE = 'notify.mobile_app_pixel_de_camille';

// Two Béthune Offres in Léa's Zone, from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OTHER_REFERENCE = '2026-2445609';

async function startHomeAssistant() {
  const fakeHomeAssistant = await startFakeHomeAssistant();
  onTestFinished(() => fakeHomeAssistant.close());
  return fakeHomeAssistant;
}

// The actions on a data folder whose config still names Léa's notify service, as data/config.json
// did before the Connexion Home Assistant moved to the database (ADR-0006)
async function openActions() {
  return createActions({ dataDirectory: createDataDirectory(), fetch: createRecordedFetch().fetch });
}

// A first Détection on the feed as it was before the two Béthune Offres, then the actions for the
// next one, which finds them and notifies through the real Home Assistant channel
async function detectBeforeBethune(dataDirectory: string) {
  const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout([REFERENCE, OTHER_REFERENCE]) } });
  const earlierActions = await createActions({ dataDirectory, fetch: earlierFetch.fetch });
  await earlierActions.detect();
  return createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the Connexion Home Assistant of a Candidat', () => {
  it('reaches the Home Assistant whose address and token it saved', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token, service: LEA_SERVICE });

    await expect(actions.testConnexionHomeAssistant({ candidatId: 'lea' })).resolves.toBeUndefined();
  });

  it('tells the Candidat to replace a token Home Assistant refuses', async () => {
    const { url } = await startHomeAssistant();
    const actions = await openActions();
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token: 'jeton-révoqué' });

    await expect(actions.testConnexionHomeAssistant({ candidatId: 'lea' })).rejects.toThrow(
      /Home Assistant a refusé le jeton \(HTTP 401\) : créer un jeton d'accès longue durée/,
    );
  });

  it('tells the Candidat to check the address of a Home Assistant it cannot reach', async () => {
    const { url, token, simulateFailure } = await startHomeAssistant();
    simulateFailure('unreachable');
    const actions = await openActions();
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token });

    await expect(actions.testConnexionHomeAssistant({ candidatId: 'lea' })).rejects.toThrow(
      new RegExp(`Home Assistant injoignable à ${url} .* vérifier l'adresse`),
    );
  });

  it('lists the notify services of its Home Assistant only', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token });

    const serviceList = await actions.listNotifyServices({ candidatId: 'lea' });

    expect(serviceList.map(({ service }) => service)).toEqual([
      LEA_SERVICE,
      CAMILLE_SERVICE,
      'notify.mobile_app_iphone_de_sacha',
    ]);
  });

  it('sends a test notification to the service it chose', async () => {
    const { url, token, notificationList } = await startHomeAssistant();
    const actions = await openActions();
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token, service: CAMILLE_SERVICE });

    await actions.sendTestNotification({ candidatId: 'lea' });

    expect(notificationList).toEqual([
      {
        service: 'mobile_app_pixel_de_camille',
        title: 'Notification de test',
        message: 'La Connexion Home Assistant de Léa fonctionne.',
      },
    ]);
  });

  it('reads back its address and service, and only whether a token is configured', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();

    // Before any save: the service data/config.json names, copied at launch
    expect(await actions.readConnexionHomeAssistant({ candidatId: 'lea' })).toEqual({
      url: null,
      service: LEA_SERVICE,
      isTokenConfigured: false,
    });
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token });
    expect(await actions.readConnexionHomeAssistant({ candidatId: 'lea' })).toEqual({
      url,
      service: LEA_SERVICE,
      isTokenConfigured: true,
    });
  });

  // The Profil tests what the Candidat typed before saving it: a refused token is never saved
  it('tests and lists an address and a token given, without saving them', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();

    await expect(
      actions.testConnexionHomeAssistant({ candidatId: 'lea', url, token: 'jeton-révoqué' }),
    ).rejects.toThrow(/Home Assistant a refusé le jeton \(HTTP 401\)/);
    await expect(actions.testConnexionHomeAssistant({ candidatId: 'lea', url, token })).resolves.toBeUndefined();
    const serviceList = await actions.listNotifyServices({ candidatId: 'lea', url, token });

    expect(serviceList.map(({ service }) => service)).toContain(LEA_SERVICE);
    expect(await actions.readConnexionHomeAssistant({ candidatId: 'lea' })).toEqual({
      url: null,
      service: LEA_SERVICE,
      isTokenConfigured: false,
    });
  });

  // Anyone on the LAN reaches the front (ADR-0002): the saved token goes to the saved address only
  it('never sends the saved token to an address given without a token', async () => {
    const { url, token } = await startHomeAssistant();
    const other = await startHomeAssistant();
    const actions = await openActions();
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token });

    await expect(actions.testConnexionHomeAssistant({ candidatId: 'lea', url: other.url })).rejects.toThrow(
      /Home Assistant n'est pas configuré pour Léa/,
    );
    await expect(actions.testConnexionHomeAssistant({ candidatId: 'lea', url })).resolves.toBeUndefined();
  });

  it('keeps the token already saved when a save gives none', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token });

    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, service: CAMILLE_SERVICE });

    await expect(actions.testConnexionHomeAssistant({ candidatId: 'lea' })).resolves.toBeUndefined();
  });

  // The fields of a form left blank arrive empty, not absent
  it('keeps the token and the service already saved when a save gives them empty', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token, service: CAMILLE_SERVICE });

    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url, token: '', service: '' });

    expect(await actions.readConnexionHomeAssistant({ candidatId: 'lea' })).toEqual({
      url,
      service: CAMILLE_SERVICE,
      isTokenConfigured: true,
    });
    await expect(actions.testConnexionHomeAssistant({ candidatId: 'lea', token: '' })).resolves.toBeUndefined();
  });

  // The token of .env would otherwise go to whatever address the Candidat saved
  it('never sends the token of .env to the address the Candidat saved', async () => {
    const environmentHomeAssistant = await startHomeAssistant();
    vi.stubEnv('HOME_ASSISTANT_URL', environmentHomeAssistant.url);
    vi.stubEnv('HOME_ASSISTANT_TOKEN', environmentHomeAssistant.token);
    const { url } = await startHomeAssistant();
    const actions = await openActions();
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url });

    await expect(actions.testConnexionHomeAssistant({ candidatId: 'lea' })).rejects.toThrow(
      /Home Assistant n'est pas configuré pour Léa/,
    );
  });

  // vitest.config.ts empties the settings of .env, which vitest never loads anyway: a test that
  // forgets the fake Home Assistant fails instead of notifying a real phone
  it('sends nothing until an address and a token are saved, or set in .env', async () => {
    const actions = await openActions();

    await expect(actions.sendTestNotification({ candidatId: 'lea' })).rejects.toThrow(
      /Home Assistant n'est pas configuré pour Léa/,
    );
  });
});

describe('the notification of a new Offre', () => {
  it('goes to the Home Assistant the Candidat saved, not to that of .env', async () => {
    const homeAssistant = await startHomeAssistant();
    const environmentHomeAssistant = await startHomeAssistant();
    vi.stubEnv('HOME_ASSISTANT_URL', environmentHomeAssistant.url);
    vi.stubEnv('HOME_ASSISTANT_TOKEN', environmentHomeAssistant.token);
    const actions = await detectBeforeBethune(createDataDirectory());
    await actions.saveConnexionHomeAssistant({ candidatId: 'lea', url: homeAssistant.url, token: homeAssistant.token });

    await actions.detect();

    expect(homeAssistant.notificationList.map(({ service }) => service)).toEqual([
      'mobile_app_iphone_de_lea',
      'mobile_app_iphone_de_lea',
    ]);
    expect(environmentHomeAssistant.notificationList).toEqual([]);
  });

  // Until the Candidat saves their Connexion (ADR-0006)
  it('falls back on the Home Assistant of .env and the service of data/config.json', async () => {
    const { url, token, notificationList } = await startHomeAssistant();
    vi.stubEnv('HOME_ASSISTANT_URL', url);
    vi.stubEnv('HOME_ASSISTANT_TOKEN', token);
    const actions = await detectBeforeBethune(createDataDirectory());

    await actions.detect();

    expect(notificationList.map(({ service }) => service)).toEqual([
      'mobile_app_iphone_de_lea',
      'mobile_app_iphone_de_lea',
    ]);
  });

  it("goes to each Candidat's own Home Assistant", async () => {
    const homeAssistantByCandidatId = { lea: await startHomeAssistant(), camille: await startHomeAssistant() };
    const dataDirectory = createDataDirectory();
    // Both follow the Offres of the courts of appeal of Douai and Amiens, without any notify service
    // in the config
    const candidatList = Object.keys(homeAssistantByCandidatId).map((id) => ({
      id,
      name: id,
      veilleList: [
        {
          id: `attache-de-justice-${id}`,
          source: 'pep',
          criteria: { title: 'attaché de justice' },
          zone: { courtOfAppealList: ['Douai', 'Amiens'] },
        },
      ],
    }));
    writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify({ defaultDelayMonths: 6, candidatList }));
    const actions = await detectBeforeBethune(dataDirectory);
    const { lea, camille } = homeAssistantByCandidatId;
    await actions.saveConnexionHomeAssistant({
      candidatId: 'lea',
      url: lea.url,
      token: lea.token,
      service: LEA_SERVICE,
    });
    await actions.saveConnexionHomeAssistant({
      candidatId: 'camille',
      url: camille.url,
      token: camille.token,
      service: CAMILLE_SERVICE,
    });

    await actions.detect();

    expect(lea.notificationList.map(({ service }) => service)).toEqual([
      'mobile_app_iphone_de_lea',
      'mobile_app_iphone_de_lea',
    ]);
    expect(camille.notificationList.map(({ service }) => service)).toEqual([
      'mobile_app_pixel_de_camille',
      'mobile_app_pixel_de_camille',
    ]);
  });
});
