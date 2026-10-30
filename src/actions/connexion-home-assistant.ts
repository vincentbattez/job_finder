import { z } from 'zod/v4';

import type { ConnexionHomeAssistant, NotifyService } from '#/domain/index.ts';
import { checkConnexion, composeTestNotification, listNotifyServices } from '#/modules/notification/index.ts';

import type { ActionContext } from './context.ts';

// A field of a form left blank arrives empty: it counts as left out
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

// A token or a service left out keeps the one saved: the front never gets the token back (ADR-0006)
const CONNEXION_INPUT_SCHEMA = z.object({
  url: z.url(),
  token: optional(z.string()),
  service: optional(z.string().startsWith('notify.')),
});

// What the Candidat typed and has not saved yet, tried in place of the saved fields
const TRIAL_INPUT_SCHEMA = CONNEXION_INPUT_SCHEMA.pick({ url: true, token: true }).partial();

// Each Candidat reaches their own Home Assistant; no action returns the token (ADR-0006,
// test/write-only-token.test.ts)
export function createConnexionHomeAssistantActions({ workspace, findCandidat, notificationChannel }: ActionContext) {
  async function findAccess(rawInput: unknown) {
    const candidat = await findCandidat(rawInput);
    return workspace.findHomeAssistantAccess(candidat.id);
  }

  // The Profil checks a token before saving it. The saved token goes to the saved address only:
  // anyone on the LAN can post another one (ADR-0002, ADR-0006).
  async function findTrialAccess(rawInput: unknown) {
    const { url = null, token = null } = TRIAL_INPUT_SCHEMA.parse(rawInput);
    const access = await findAccess(rawInput);
    const isSavedAddress = url === null || url === access.url;
    return { ...access, url: url ?? access.url, token: token ?? (isSavedAddress ? access.token : null) };
  }

  return {
    async readConnexionHomeAssistant(rawInput: unknown): Promise<ConnexionHomeAssistant> {
      return workspace.readConnexionHomeAssistant(await findCandidat(rawInput));
    },

    async saveConnexionHomeAssistant(rawInput: unknown): Promise<void> {
      const { url, token, service } = CONNEXION_INPUT_SCHEMA.parse(rawInput);
      await workspace.saveConnexionHomeAssistant(await findCandidat(rawInput), { url, token, service });
    },

    async testConnexionHomeAssistant(rawInput: unknown): Promise<void> {
      await checkConnexion(await findTrialAccess(rawInput));
    },

    async listNotifyServices(rawInput: unknown): Promise<NotifyService[]> {
      return listNotifyServices(await findTrialAccess(rawInput));
    },

    async sendTestNotification(rawInput: unknown): Promise<void> {
      const access = await findAccess(rawInput);
      await notificationChannel.send(access, composeTestNotification(access.candidatName));
    },
  };
}
