import { z } from 'zod/v4';

import { PARAMETER_CHOICE_SCHEMA, type ParameterChoice } from '#/domain/index.ts';
import type { INotification } from '#/notification/index.ts';
import { messageOf } from '#/text/index.ts';

// What reaching a Home Assistant takes. A test or a list of services tries what the Candidate typed,
// so either may be missing there.
interface IAccess {
  url?: string | undefined;
  token?: string | undefined;
}

const ADDRESS_ADVICE = "vérifier que l'adresse du Canal de notification est bien celle de Home Assistant.";

// GET /api/services lists every domain, not only notify
const SERVICE_BY_NAME_SCHEMA = z.record(z.string(), z.object({ name: z.string().optional() }));
const SERVICE_DOMAIN_LIST_SCHEMA = z.array(z.object({ domain: z.string(), services: SERVICE_BY_NAME_SCHEMA }));

// Every call to the REST API of Home Assistant, whose failures say what to do; the token never
// appears in a message, which reaches the front (ADR-0006)
async function request({ url, token }: IAccess, pathname: string, body?: unknown): Promise<Response> {
  if (url === undefined || token === undefined) {
    throw new Error(
      "Home Assistant n'est pas configuré : saisir son adresse et un jeton d'accès longue durée dans la section Notifications du Profil.",
    );
  }
  let response: Response;
  try {
    response = await fetch(new URL(pathname, url), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new Error(
      `Home Assistant injoignable à ${url} (${messageOf(error)}) : vérifier l'adresse du Canal de notification, et que Home Assistant tourne.`,
      { cause: error },
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Home Assistant a refusé le jeton (HTTP ${String(response.status)}) : créer un jeton d'accès longue durée (Home Assistant, profil, onglet Sécurité) et l'enregistrer dans le Canal de notification.`,
    );
  }
  return response;
}

// Before the Candidate relies on it: a wrong address or token fails here rather than on a new Offre
export async function checkConnexion(access: IAccess): Promise<void> {
  const response = await request(access, '/api/');
  if (!response.ok) {
    throw new Error(`Home Assistant a répondu HTTP ${String(response.status)} : ${ADDRESS_ADVICE}`);
  }
}

export async function listNotifyServices(access: IAccess): Promise<ParameterChoice[]> {
  const response = await request(access, '/api/services');
  const domainList = response.ok ? SERVICE_DOMAIN_LIST_SCHEMA.safeParse(await response.json()) : undefined;
  if (domainList?.success !== true) {
    throw new Error(
      `Home Assistant n'a pas donné la liste de ses services (HTTP ${String(response.status)}) : ${ADDRESS_ADVICE}`,
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
): Promise<void> {
  const response = await request(access, `/api/services/notify/${service.replace(/^notify\./, '')}`, notification);
  if (!response.ok) {
    throw new Error(
      `Home Assistant a refusé la notification vers ${service} (HTTP ${String(response.status)}) : vérifier le service de notification du Canal.`,
    );
  }
}
