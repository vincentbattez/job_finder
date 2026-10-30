import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { HOME_ASSISTANT } from '#/modules/notification/index.ts';

import { startFakeHomeAssistant } from './fake-home-assistant.ts';

const LEA_TARGET = 'notify.mobile_app_iphone_de_lea';
const NOTIFICATION = { title: 'Recherche prête', message: 'Attaché de justice\nTribunal Judiciaire de Béthune' };

// The settings of .env point to the fake Home Assistant, which answers over HTTP
async function startHomeAssistant({ token }: { token?: string } = {}) {
  const fakeHomeAssistant = await startFakeHomeAssistant();
  onTestFinished(() => fakeHomeAssistant.close());
  vi.stubEnv('HOME_ASSISTANT_URL', fakeHomeAssistant.url);
  vi.stubEnv('HOME_ASSISTANT_TOKEN', token ?? fakeHomeAssistant.token);
  return fakeHomeAssistant;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the Home Assistant channel', () => {
  it('calls the notify service of the Candidat through the REST API, with the token of .env', async () => {
    const { notificationList } = await startHomeAssistant();

    await HOME_ASSISTANT.send(LEA_TARGET, NOTIFICATION);

    expect(notificationList).toEqual([{ service: 'mobile_app_iphone_de_lea', ...NOTIFICATION }]);
  });

  it('fails visibly when Home Assistant refuses the token', async () => {
    const { notificationList } = await startHomeAssistant({ token: 'jeton-révoqué' });

    await expect(HOME_ASSISTANT.send(LEA_TARGET, NOTIFICATION)).rejects.toThrow(/HTTP 401.*HOME_ASSISTANT_TOKEN/);
    expect(notificationList).toEqual([]);
  });

  it('fails visibly when Home Assistant cannot be reached', async () => {
    const { simulateFailure, url } = await startHomeAssistant();
    simulateFailure('unreachable');

    await expect(HOME_ASSISTANT.send(LEA_TARGET, NOTIFICATION)).rejects.toThrow(
      new RegExp(`injoignable à ${url}.*HOME_ASSISTANT_URL`),
    );
  });

  // vitest.config.ts empties the settings of .env, which vitest never loads anyway: a test that
  // forgets the fake Home Assistant fails instead of notifying a real phone
  it('sends nothing in the tests unless one points it to the fake', async () => {
    await expect(HOME_ASSISTANT.send(LEA_TARGET, NOTIFICATION)).rejects.toThrow(/Home Assistant n'est pas configuré/);
  });
});
