import { describe, expect, it, onTestFinished } from 'vitest';
import { z } from 'zod/v4';

import { startFakeHomeAssistant } from './fake-home-assistant.ts';

// The answer of GET /api/services: the services of each domain, by name
const SERVICE_BY_NAME_SCHEMA = z.record(z.string(), z.object({ name: z.string() }));
const SERVICE_DOMAIN_LIST_SCHEMA = z.array(z.object({ domain: z.string(), services: SERVICE_BY_NAME_SCHEMA }));

const NOTIFICATION = { title: 'Recherche prête', message: 'Attaché de justice' };

// Starts the fake for this test only, with a request helper that sends its token unless told otherwise
async function start() {
  const fakeHomeAssistant = await startFakeHomeAssistant();
  onTestFinished(() => fakeHomeAssistant.close());
  const { url, token } = fakeHomeAssistant;
  const request = (
    pathname: string,
    { authorization = `Bearer ${token}`, body }: { authorization?: string; body?: unknown } = {},
  ) =>
    fetch(new URL(pathname, url), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  const statusOf = async (pathname: string, option?: { authorization?: string }) => {
    const response = await request(pathname, option);
    return response.status;
  };
  return { ...fakeHomeAssistant, request, statusOf };
}

describe('the fake Home Assistant', () => {
  it('checks the token on its API root', async () => {
    const { statusOf } = await start();

    expect(await statusOf('/api/')).toBe(200);
    expect(await statusOf('/api/', { authorization: 'Bearer faux-jeton' })).toBe(401);
    expect(await statusOf('/api/', { authorization: '' })).toBe(401);
  });

  it('lists its services, among them several notify services', async () => {
    const { request } = await start();

    const response = await request('/api/services');

    expect(response.status).toBe(200);
    const serviceDomainList = SERVICE_DOMAIN_LIST_SCHEMA.parse(await response.json());
    const notifyServiceList = serviceDomainList
      .filter(({ domain }) => domain === 'notify')
      .flatMap(({ services }) => Object.keys(services));
    expect(notifyServiceList).toEqual(
      expect.arrayContaining(['mobile_app_iphone_de_lea', 'mobile_app_pixel_de_camille']),
    );
  });

  it('records a notification sent to one of its notify services', async () => {
    const { request, notificationList } = await start();

    const response = await request('/api/services/notify/mobile_app_iphone_de_lea', { body: NOTIFICATION });

    expect(response.status).toBe(200);
    expect(notificationList).toEqual([{ service: 'mobile_app_iphone_de_lea', ...NOTIFICATION }]);
  });

  it('refuses a wrong token, and records nothing', async () => {
    const { request, notificationList } = await start();

    const response = await request('/api/services/notify/mobile_app_iphone_de_lea', {
      authorization: 'Bearer faux-jeton',
      body: NOTIFICATION,
    });

    expect(response.status).toBe(401);
    expect(notificationList).toEqual([]);
  });

  it('refuses a notify service it does not have, and records nothing', async () => {
    const { request, notificationList } = await start();

    const response = await request('/api/services/notify/mobile_app_inconnu', { body: NOTIFICATION });

    expect(response.status).toBe(400);
    expect(notificationList).toEqual([]);
  });

  it('simulates a failure: a refused token, a server error, then no answer at all', async () => {
    const { statusOf, simulateFailure } = await start();

    simulateFailure(401);
    expect(await statusOf('/api/')).toBe(401);
    simulateFailure(500);
    expect(await statusOf('/api/services')).toBe(500);
    simulateFailure('unreachable');
    await expect(statusOf('/api/')).rejects.toThrow('fetch failed');
    simulateFailure(undefined);
    expect(await statusOf('/api/')).toBe(200);
  });

  // The front and the worker of the e2e tests send from their own processes: the tests read there
  // what the fake received
  it('serves the notifications it received, for the tests of another process', async () => {
    const { request } = await start();
    await request('/api/services/notify/mobile_app_iphone_de_lea', { body: NOTIFICATION });

    const response = await request('/fake/notifications', { authorization: '' });

    const notificationList: unknown = await response.json();
    expect(notificationList).toEqual([{ service: 'mobile_app_iphone_de_lea', ...NOTIFICATION }]);
  });
});
