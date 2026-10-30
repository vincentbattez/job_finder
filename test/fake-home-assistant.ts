import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { text } from 'node:stream/consumers';

import { z } from 'zod/v4';

// The only token the fake accepts, which playwright.config.ts hands to the front and the worker
export const FAKE_HOME_ASSISTANT_TOKEN = 'jeton-du-faux-home-assistant';

// The notify services of the Candidates of the tests, one phone each
const NOTIFY_SERVICE_LIST = ['mobile_app_iphone_de_lea', 'mobile_app_pixel_de_camille', 'mobile_app_iphone_de_sacha'];

// Home Assistant lists every domain, not only notify
const SERVICE_DOMAIN_LIST = [
  { domain: 'light', services: { turn_on: { name: 'Turn on', description: 'Turns on one or more lights.' } } },
  {
    domain: 'notify',
    services: Object.fromEntries(
      NOTIFY_SERVICE_LIST.map((service) => [service, { name: `Send a notification via ${service}`, description: '' }]),
    ),
  },
];

const NOTIFY_PATH_PATTERN = /^\/api\/services\/notify\/([^/]+)$/;

const NOTIFICATION_BODY_SCHEMA = z.object({ title: z.string(), message: z.string() });

function readNotification(rawBody: string) {
  try {
    return NOTIFICATION_BODY_SCHEMA.safeParse(JSON.parse(rawBody));
  } catch {
    return NOTIFICATION_BODY_SCHEMA.safeParse(undefined);
  }
}

interface IReceivedNotification {
  service: string;
  title: string;
  message: string;
}

function answer(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

// Stands in for Home Assistant, an external boundary: answers like its REST API on what the tool
// uses, on a free port unless given one, and records the notifications it receives
export async function startFakeHomeAssistant({ port = 0 }: { port?: number } = {}) {
  // A failure of Home Assistant: a refused token, a server error, or no answer at all
  type Failure = 401 | 500 | 'unreachable' | undefined;
  const notificationList: IReceivedNotification[] = [];
  // The Authorization header of every request to its API, to check where a token went
  const authorizationList: string[] = [];
  let failure: Failure;

  async function route(request: IncomingMessage, response: ServerResponse) {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    // Not in Home Assistant: how the e2e tests read, from their own process, what the fake received
    if (pathname === '/fake/notifications') {
      answer(response, 200, notificationList);
      return;
    }
    authorizationList.push(request.headers.authorization ?? '');
    if (failure === 'unreachable') {
      request.socket.destroy();
      return;
    }
    if (failure !== undefined) {
      answer(response, failure, { message: 'Simulated failure' });
      return;
    }
    if (request.headers.authorization !== `Bearer ${FAKE_HOME_ASSISTANT_TOKEN}`) {
      answer(response, 401, { message: 'Unauthorized' });
      return;
    }
    if (pathname === '/api/' && request.method === 'GET') {
      answer(response, 200, { message: 'API running.' });
      return;
    }
    if (pathname === '/api/services' && request.method === 'GET') {
      answer(response, 200, SERVICE_DOMAIN_LIST);
      return;
    }
    const service = NOTIFY_PATH_PATTERN.exec(pathname)?.[1];
    if (service !== undefined && request.method === 'POST') {
      if (!NOTIFY_SERVICE_LIST.includes(service)) {
        answer(response, 400, { message: `Service notify.${service} not found.` });
        return;
      }
      const notification = readNotification(await text(request));
      if (!notification.success) {
        answer(response, 400, { message: 'Invalid JSON.' });
        return;
      }
      notificationList.push({ service, ...notification.data });
      answer(response, 200, []);
      return;
    }
    answer(response, 404, { message: 'Not found' });
  }

  const server = createServer((request, response) => {
    void route(request, response);
  });
  await new Promise<void>((resolve) => server.listen(port, 'localhost', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The fake Home Assistant listens on no TCP port.');
  }

  return {
    url: `http://localhost:${String(address.port)}`,
    token: FAKE_HOME_ASSISTANT_TOKEN,
    notificationList,
    authorizationList,
    simulateFailure: (nextFailure: Failure) => {
      failure = nextFailure;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      }),
  };
}
