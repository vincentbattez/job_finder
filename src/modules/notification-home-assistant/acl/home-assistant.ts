import { z } from 'zod/v4';

import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import { PARAMETER_CHOICE_SCHEMA, type Locale, type ParameterChoice } from '#/domain/index.ts';
import { COPY_NAMESPACE } from '#/modules/notification-home-assistant/copy.ts';
import type { INotification } from '#/notification/index.ts';
import { messageOf } from '#/text/index.ts';

// What reaching a Home Assistant takes. A test or a list of services tries what the Candidate typed,
// so either may be missing there.
interface IAccess {
  url?: string | undefined;
  token?: string | undefined;
}

// GET /api/services lists every domain, not only notify
const SERVICE_BY_NAME_SCHEMA = z.record(z.string(), z.object({ name: z.string().optional() }));
const SERVICE_DOMAIN_LIST_SCHEMA = z.array(z.object({ domain: z.string(), services: SERVICE_BY_NAME_SCHEMA }));

// A Home Assistant that never answers would hold the Detection or the job that notifies: past this,
// it is unreachable
const REQUEST_TIMEOUT_MS = 10_000;

// Every call to the REST API of Home Assistant, whose failures say what to do; the token never
// appears in a message, which reaches the front (ADR-0006)
async function request({ url, token }: IAccess, locale: Locale, pathname: string, body?: unknown): Promise<Response> {
  const t = tFor(locale, COPY_NAMESPACE);
  if (url === undefined || token === undefined) {
    throw codedError('channel_not_configured', { detail: t('notConfigured') }, { locale });
  }
  let response: Response;
  try {
    response = await fetch(new URL(pathname, url), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw codedError(
      'channel_unreachable',
      { detail: t('unreachable', { url, reason: messageOf(error) }) },
      { locale, cause: error },
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw codedError('channel_token_refused', { detail: t('tokenRefused', { status: response.status }) }, { locale });
  }
  return response;
}

// Before the Candidate relies on it: a wrong address or token fails here rather than on a new Posting
export async function checkConnection(access: IAccess, locale: Locale): Promise<void> {
  const response = await request(access, locale, '/api/');
  if (!response.ok) {
    throw codedError(
      'channel_status',
      { detail: tFor(locale, COPY_NAMESPACE)('unexpectedStatus', { status: response.status }) },
      { locale },
    );
  }
}

export async function listNotifyServices(access: IAccess, locale: Locale): Promise<ParameterChoice[]> {
  const response = await request(access, locale, '/api/services');
  const domainList = response.ok ? SERVICE_DOMAIN_LIST_SCHEMA.safeParse(await response.json()) : undefined;
  if (domainList?.success !== true) {
    throw codedError(
      'channel_status',
      { detail: tFor(locale, COPY_NAMESPACE)('noServiceList', { status: response.status }) },
      { locale },
    );
  }
  const services = domainList.data.find(({ domain }) => domain === 'notify')?.services ?? {};
  return Object.entries(services).map(([name, { name: label = name }]) =>
    PARAMETER_CHOICE_SCHEMA.parse({ value: `notify.${name}`, label }),
  );
}

// Calls a notify service, such as notify.mobile_app_iphone_de_lea, which pushes the notification to
// the phone of its app
export async function callNotifyService(
  { service, ...access }: { url: string; token: string; service: string },
  notification: INotification,
  locale: Locale,
): Promise<void> {
  const servicePath = `/api/services/notify/${service.replace(/^notify\./, '')}`;
  const response = await request(access, locale, servicePath, notification);
  if (!response.ok) {
    throw codedError(
      'channel_status',
      { detail: tFor(locale, COPY_NAMESPACE)('notificationRefused', { service, status: response.status }) },
      { locale },
    );
  }
}
