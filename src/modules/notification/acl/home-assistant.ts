import { z } from 'zod/v4';

import { NOTIFY_SERVICE_SCHEMA, type HomeAssistantAccess, type NotifyService } from '#/domain/index.ts';
import { messageOf } from '#/text/index.ts';

// The fallback of a Candidat who has not saved their Connexion yet (ADR-0006), from .env; empty
// counts as unset, as vitest.config.ts leaves it
const ENVIRONMENT_SCHEMA = z.object({
  HOME_ASSISTANT_URL: z.union([z.literal(''), z.url()]).optional(),
  HOME_ASSISTANT_TOKEN: z.string().optional(),
});

const ADDRESS_ADVICE = "vérifier que l'adresse de la Connexion Home Assistant est bien celle de Home Assistant.";

// GET /api/services lists every domain, not only notify
const SERVICE_BY_NAME_SCHEMA = z.record(z.string(), z.object({ name: z.string().optional() }));
const SERVICE_DOMAIN_LIST_SCHEMA = z.array(z.object({ domain: z.string(), services: SERVICE_BY_NAME_SCHEMA }));

function readEnvironmentCredentials() {
  const environment = ENVIRONMENT_SCHEMA.safeParse(process.env);
  if (!environment.success) {
    throw new Error("HOME_ASSISTANT_URL n'est pas une adresse : la corriger dans .env, sur le modèle de .env.example.");
  }
  const { HOME_ASSISTANT_URL: url = '', HOME_ASSISTANT_TOKEN: token = '' } = environment.data;
  return { url: url === '' ? null : url, token: token === '' ? null : token };
}

// The Candidat's own pair, or else that of .env, never mixed: the token of .env would otherwise go to
// whatever address the Candidat saved (ADR-0006)
function resolveCredentials({ candidatName, url, token }: HomeAssistantAccess) {
  const { url: baseUrl, token: bearer } =
    url === null && token === null ? readEnvironmentCredentials() : { url, token };
  if (baseUrl === null || bearer === null) {
    throw new Error(
      `Home Assistant n'est pas configuré pour ${candidatName} : enregistrer l'adresse et le jeton de sa Connexion Home Assistant, ou renseigner HOME_ASSISTANT_URL et HOME_ASSISTANT_TOKEN dans .env.`,
    );
  }
  return { baseUrl, bearer };
}

// Every call to the REST API of Home Assistant, whose failures say what to do; the token never
// appears in a message, which reaches the front (ADR-0006)
async function request(access: HomeAssistantAccess, pathname: string, body?: unknown): Promise<Response> {
  const { baseUrl, bearer } = resolveCredentials(access);
  let response: Response;
  try {
    response = await fetch(new URL(pathname, baseUrl), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new Error(
      `Home Assistant injoignable à ${baseUrl} (${messageOf(error)}) : vérifier l'adresse de la Connexion Home Assistant, et que Home Assistant tourne.`,
      { cause: error },
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Home Assistant a refusé le jeton (HTTP ${String(response.status)}) : créer un jeton d'accès longue durée (Home Assistant, profil, onglet Sécurité) et l'enregistrer dans la Connexion Home Assistant.`,
    );
  }
  return response;
}

// Before the Candidat relies on it: a wrong address or token fails here rather than on a new Offre
export async function checkConnexion(access: HomeAssistantAccess): Promise<void> {
  const response = await request(access, '/api/');
  if (!response.ok) {
    throw new Error(`Home Assistant a répondu HTTP ${String(response.status)} : ${ADDRESS_ADVICE}`);
  }
}

export async function listNotifyServices(access: HomeAssistantAccess): Promise<NotifyService[]> {
  const response = await request(access, '/api/services');
  const domainList = response.ok ? SERVICE_DOMAIN_LIST_SCHEMA.safeParse(await response.json()) : undefined;
  if (domainList?.success !== true) {
    throw new Error(
      `Home Assistant n'a pas donné la liste de ses services (HTTP ${String(response.status)}) : ${ADDRESS_ADVICE}`,
    );
  }
  const services = domainList.data.find(({ domain }) => domain === 'notify')?.services ?? {};
  return Object.entries(services).map(([name, { name: label = name }]) =>
    NOTIFY_SERVICE_SCHEMA.parse({ service: `notify.${name}`, name: label }),
  );
}

// Calls a notify service, such as notify.mobile_app_iphone_de_lea, which pushes the notification to
// the phone of its app
export async function callNotifyService(access: HomeAssistantAccess, notification: { title: string; message: string }) {
  const { candidatName, service } = access;
  if (service === null) {
    throw new Error(
      `Aucun service de notification pour ${candidatName} : en choisir un dans sa Connexion Home Assistant.`,
    );
  }
  const response = await request(access, `/api/services/notify/${service.replace(/^notify\./, '')}`, notification);
  if (!response.ok) {
    throw new Error(
      `Home Assistant a refusé la notification vers ${service} (HTTP ${String(response.status)}) : vérifier le service de notification de la Connexion Home Assistant.`,
    );
  }
}
