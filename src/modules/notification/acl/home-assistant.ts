import { z } from 'zod/v4';

import { messageOf } from '#/text/index.ts';

// Set in .env, which jf and the worker load at launch; never in the tests (vitest.config.ts)
const ENVIRONMENT_SCHEMA = z.object({
  HOME_ASSISTANT_URL: z.url(),
  HOME_ASSISTANT_TOKEN: z.string().min(1),
});

// Calls a notify service through the REST API of Home Assistant, such as
// notify.mobile_app_iphone_de_lea, which pushes the notification to the phone of its app
export async function callNotifyService(service: string, { title, message }: { title: string; message: string }) {
  const environment = ENVIRONMENT_SCHEMA.safeParse(process.env);
  if (!environment.success) {
    throw new Error(
      "Home Assistant n'est pas configuré : renseigner HOME_ASSISTANT_URL et HOME_ASSISTANT_TOKEN dans .env, sur le modèle de .env.example.",
    );
  }
  const { HOME_ASSISTANT_URL: baseUrl, HOME_ASSISTANT_TOKEN: token } = environment.data;
  const url = new URL(`/api/services/notify/${service.replace(/^notify\./, '')}`, baseUrl);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message }),
    });
  } catch (error) {
    const reason = messageOf(error);
    throw new Error(`Home Assistant injoignable à ${baseUrl} (${reason}) : vérifier HOME_ASSISTANT_URL dans .env.`, {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new Error(
      `Home Assistant a refusé la notification vers ${service} (HTTP ${String(response.status)}) : vérifier HOME_ASSISTANT_TOKEN dans .env, et la cible du Candidat dans data/config.json.`,
    );
  }
}
