import { describe, expect, it, onTestFinished } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { startFakeHomeAssistant } from './fake-home-assistant.ts';
import { LEA_VEILLE } from './lea.ts';
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

async function openActions() {
  return createActions({ dataDirectory: createDataDirectory(), fetch: createRecordedFetch().fetch });
}

// The Canal de notification of the module home-assistant, through the generic actions of the family
// (ADR-0010)
function saveCanal(actions: Actions, parametres: object, candidateId = 'lea') {
  return actions.saveCanalNotification({ candidateId, canal: 'home-assistant', parametres });
}

function testCanal(actions: Actions, parametres: object = {}) {
  return actions.testCanalNotification({ candidateId: 'lea', parametres });
}

// A first Détection on the feed as it was before the two Béthune Offres, then the actions for the
// next one, which finds them and notifies through the real Home Assistant module
async function detectBeforeBethune(dataDirectory: string) {
  const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout([REFERENCE, OTHER_REFERENCE]) } });
  const earlierActions = await createActions({ dataDirectory, fetch: earlierFetch.fetch });
  await earlierActions.detect();
  return createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
}

describe('the Canal de notification Home Assistant of a Candidate', () => {
  it('is one of the Canaux offered, with its address, its write-only token and its service to choose', async () => {
    const actions = await openActions();

    // Among the other modules of the registry, whichever they are
    expect(await actions.listCanauxNotification()).toContainEqual(
      expect.objectContaining({
        id: 'home-assistant',
        name: 'Home Assistant',
        isTestable: true,
        parametreList: [
          expect.objectContaining({ name: 'url', type: 'url', isRequired: true, isSecret: false, hasChoices: false }),
          expect.objectContaining({ name: 'token', isRequired: true, isSecret: true, hasChoices: false }),
          expect.objectContaining({ name: 'service', isRequired: true, isSecret: false, hasChoices: true }),
        ],
      }),
    );
  });

  it('reaches the Home Assistant whose address and token it saved', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();
    await saveCanal(actions, { url, token, service: LEA_SERVICE });

    await expect(testCanal(actions)).resolves.toBeUndefined();
  });

  it('tells the Candidate to replace a token Home Assistant refuses', async () => {
    const { url } = await startHomeAssistant();
    const actions = await openActions();
    await saveCanal(actions, { url, token: 'jeton-révoqué', service: LEA_SERVICE });

    await expect(testCanal(actions)).rejects.toThrow(
      /Home Assistant a refusé le jeton \(HTTP 401\) : créer un jeton d'accès longue durée/,
    );
  });

  it('tells the Candidate to check the address of a Home Assistant it cannot reach', async () => {
    const { url, token, simulateFailure } = await startHomeAssistant();
    simulateFailure('unreachable');
    const actions = await openActions();
    await saveCanal(actions, { url, token, service: LEA_SERVICE });

    await expect(testCanal(actions)).rejects.toThrow(
      new RegExp(`Home Assistant injoignable à ${url} .* vérifier l'adresse`),
    );
  });

  it('lists the notify services of its Home Assistant only, as the choices of its service', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();

    const choiceList = await actions.listParametreChoices({
      candidateId: 'lea',
      canal: 'home-assistant',
      parametre: 'service',
      parametres: { url, token },
    });

    expect(choiceList.map(({ value }) => value)).toEqual([
      LEA_SERVICE,
      CAMILLE_SERVICE,
      'notify.mobile_app_iphone_de_sacha',
    ]);
  });

  it('sends a test notification to the service it chose', async () => {
    const { url, token, notificationList } = await startHomeAssistant();
    const actions = await openActions();
    await saveCanal(actions, { url, token, service: CAMILLE_SERVICE });

    await actions.sendTestNotification({ candidateId: 'lea' });

    expect(notificationList).toEqual([
      {
        service: 'mobile_app_pixel_de_camille',
        title: 'Notification de test',
        message: 'Le Canal de notification de Léa fonctionne.',
      },
    ]);
  });

  it('reads back its address and service, and only whether a token is configured', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();

    expect(await actions.readCanalNotification({ candidateId: 'lea' })).toEqual({
      module: null,
      parametres: {},
      configuredSecretList: [],
    });
    await saveCanal(actions, { url, token, service: LEA_SERVICE });
    expect(await actions.readCanalNotification({ candidateId: 'lea' })).toEqual({
      module: 'home-assistant',
      parametres: { url, service: LEA_SERVICE },
      configuredSecretList: ['token'],
    });
  });

  // The Profile tests what the Candidate typed before saving it: a refused token is never saved
  it('tests and lists an address and a token given, without saving them', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();
    const trial = { candidateId: 'lea', canal: 'home-assistant' };

    await expect(
      actions.testCanalNotification({ ...trial, parametres: { url, token: 'jeton-révoqué' } }),
    ).rejects.toThrow(/Home Assistant a refusé le jeton \(HTTP 401\)/);
    await expect(actions.testCanalNotification({ ...trial, parametres: { url, token } })).resolves.toBeUndefined();

    expect(await actions.readCanalNotification({ candidateId: 'lea' })).toMatchObject({ module: null });
  });

  // Anyone on the LAN reaches the front (ADR-0002): the saved token goes to the saved address only
  it('never sends the saved token to an address given without a token', async () => {
    const { url, token } = await startHomeAssistant();
    const other = await startHomeAssistant();
    const actions = await openActions();
    await saveCanal(actions, { url, token, service: LEA_SERVICE });

    await expect(testCanal(actions, { url: other.url })).rejects.toThrow(/Home Assistant n'est pas configuré/);
    await expect(
      actions.listParametreChoices({ candidateId: 'lea', parametre: 'service', parametres: { url: other.url } }),
    ).rejects.toThrow(/Home Assistant n'est pas configuré/);
    await expect(saveCanal(actions, { url: other.url })).rejects.toThrow(
      /Le Canal de notification Home Assistant est incomplet : renseigner « Jeton d’accès longue durée »/,
    );
    await actions.sendTestNotification({ candidateId: 'lea' });

    expect(other.authorizationList).toEqual([]);
    await expect(testCanal(actions, { url })).resolves.toBeUndefined();
  });

  it('keeps the token already saved when a save gives none, the service changed', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();
    await saveCanal(actions, { url, token, service: LEA_SERVICE });

    await saveCanal(actions, { url, service: CAMILLE_SERVICE });

    await expect(testCanal(actions)).resolves.toBeUndefined();
    expect(await actions.readCanalNotification({ candidateId: 'lea' })).toMatchObject({
      parametres: { service: CAMILLE_SERVICE },
      configuredSecretList: ['token'],
    });
  });

  // The fields of a form left blank arrive empty, not absent
  it('keeps the token and the service already saved when a save gives them empty', async () => {
    const { url, token } = await startHomeAssistant();
    const actions = await openActions();
    await saveCanal(actions, { url, token, service: CAMILLE_SERVICE });

    await saveCanal(actions, { url, token: '', service: '' });

    expect(await actions.readCanalNotification({ candidateId: 'lea' })).toEqual({
      module: 'home-assistant',
      parametres: { url, service: CAMILLE_SERVICE },
      configuredSecretList: ['token'],
    });
    await expect(testCanal(actions, { token: '' })).resolves.toBeUndefined();
  });

  it('refuses a Canal no module provides', async () => {
    const actions = await openActions();

    await expect(
      actions.saveCanalNotification({ candidateId: 'lea', canal: 'pigeon-voyageur', parametres: {} }),
    ).rejects.toThrow(/Canal de notification inconnu : pigeon-voyageur/);
  });

  // No fallback any more (ADR-0006): a test that forgets the fake never notifies a real phone
  it('sends nothing until a Canal is saved', async () => {
    const actions = await openActions();

    await expect(actions.sendTestNotification({ candidateId: 'lea' })).rejects.toThrow(
      /Aucun Canal de notification pour Léa : en choisir un dans la section Notifications de son Profil/,
    );
  });
});

describe('the notification of a new Offre', () => {
  it('goes to the Home Assistant the Candidate saved', async () => {
    const homeAssistant = await startHomeAssistant();
    const actions = await detectBeforeBethune(createDataDirectory());
    await saveCanal(actions, { url: homeAssistant.url, token: homeAssistant.token, service: LEA_SERVICE });

    await actions.detect();

    expect(homeAssistant.notificationList.map(({ service }) => service)).toEqual([
      'mobile_app_iphone_de_lea',
      'mobile_app_iphone_de_lea',
    ]);
  });

  it("goes to each Candidate's own Home Assistant", async () => {
    const homeAssistantByCandidateId = { lea: await startHomeAssistant(), camille: await startHomeAssistant() };
    const dataDirectory = createDataDirectory();
    // Camille follows the same Offres as Léa, those of the courts of appeal of Douai and Amiens
    const frontActions = await createActions({ dataDirectory });
    await frontActions.createCandidate({ id: 'camille', name: 'Camille' });
    await frontActions.saveVeille({ candidateId: 'camille', ...LEA_VEILLE });
    const actions = await detectBeforeBethune(dataDirectory);
    const { lea, camille } = homeAssistantByCandidateId;
    await saveCanal(actions, { url: lea.url, token: lea.token, service: LEA_SERVICE });
    await saveCanal(actions, { url: camille.url, token: camille.token, service: CAMILLE_SERVICE }, 'camille');

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
