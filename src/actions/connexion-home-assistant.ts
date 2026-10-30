import { z } from 'zod/v4';

import type { ConnexionHomeAssistant, NotifyService } from '#/domain/index.ts';
import { checkConnexion, composeTestNotification, listNotifyServices } from '#/modules/notification/index.ts';

import type { ActionContext } from './context.ts';

// A token or a service left out keeps the one saved: the front never gets the token back (ADR-0006)
const CONNEXION_INPUT_SCHEMA = z.object({
  url: z.url(),
  token: z.string().min(1).optional(),
  service: z.string().startsWith('notify.').optional(),
});

// Each Candidat reaches their own Home Assistant; no action returns the token (ADR-0006,
// test/write-only-token.test.ts)
export function createConnexionHomeAssistantActions({ workspace, findCandidat, notificationChannel }: ActionContext) {
  async function findAccess(rawInput: unknown) {
    const candidat = await findCandidat(rawInput);
    return workspace.findHomeAssistantAccess(candidat.id);
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
      await checkConnexion(await findAccess(rawInput));
    },

    async listNotifyServices(rawInput: unknown): Promise<NotifyService[]> {
      return listNotifyServices(await findAccess(rawInput));
    },

    async sendTestNotification(rawInput: unknown): Promise<void> {
      const access = await findAccess(rawInput);
      await notificationChannel.send(access, composeTestNotification(access.candidatName));
    },
  };
}
