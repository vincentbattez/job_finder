import { afterEach, describe, expect, it, vi } from 'vitest';

import { HOME_ASSISTANT } from '#/modules/notification/index.ts';

const LEA_TARGET = 'notify.mobile_app_iphone_de_lea';
const NOTIFICATION = { title: 'Recherche prête', message: 'Attaché de justice\nTribunal Judiciaire de Béthune' };

// Stands in for Home Assistant: records each request and answers with the given status
function stubHomeAssistant(status = 200) {
  vi.stubEnv('HOME_ASSISTANT_URL', 'http://home-assistant.test:8123');
  vi.stubEnv('HOME_ASSISTANT_TOKEN', 'jeton-de-test');
  const fetchSpy = vi.fn<typeof fetch>(() => Promise.resolve(new Response('[]', { status })));
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('the Home Assistant channel', () => {
  it('calls the notify service of the Candidat through the REST API, with the token of .env', async () => {
    const fetchSpy = stubHomeAssistant();

    await HOME_ASSISTANT.send(LEA_TARGET, NOTIFICATION);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toEqual(new URL('http://home-assistant.test:8123/api/services/notify/mobile_app_iphone_de_lea'));
    expect(init).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer jeton-de-test', 'Content-Type': 'application/json' },
      body: JSON.stringify(NOTIFICATION),
    });
  });

  it('fails visibly when Home Assistant refuses the notification', async () => {
    stubHomeAssistant(401);

    await expect(HOME_ASSISTANT.send(LEA_TARGET, NOTIFICATION)).rejects.toThrow(/HTTP 401.*HOME_ASSISTANT_TOKEN/);
  });

  it('fails visibly when Home Assistant cannot be reached', async () => {
    stubHomeAssistant().mockRejectedValue(new TypeError('fetch failed'));

    await expect(HOME_ASSISTANT.send(LEA_TARGET, NOTIFICATION)).rejects.toThrow(
      /injoignable à http:\/\/home-assistant\.test:8123.*HOME_ASSISTANT_URL/,
    );
  });

  // vitest.config.ts empties the settings of .env, which vitest never loads anyway: a test that
  // forgets the fake channel fails instead of notifying a real phone
  it('sends nothing in the tests unless one stubs its settings', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(HOME_ASSISTANT.send(LEA_TARGET, NOTIFICATION)).rejects.toThrow(/Home Assistant n'est pas configuré/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
