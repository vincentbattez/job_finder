import { z } from 'zod/v4';

import type { Actions } from '#/actions/index.ts';
import { addResources, textKeyOf } from '#/domain/catalogue/i18n.ts';
import { defineNotificationChannel, type INotification } from '#/notification/index.ts';
import { parameter } from '#/parameter/index.ts';

interface ISentNotification extends INotification {
  target: string;
}

// The words of the fake Channel, in its own namespace as a real module's (ADR-0010, ADR-0012)
const COPY_EN = { targetLabel: 'Target' };

declare module 'i18next' {
  interface ResourceNamespaceMap {
    fakeNotificationChannel: typeof COPY_EN;
  }
}

addResources('fakeNotificationChannel', { en: COPY_EN, fr: { targetLabel: 'Cible' } });

// Léa's phone, the target of the fake Channel the tests save for her
export const LEA_TARGET = 'notify.mobile_app_iphone_de_lea';

// Stands in for the Notification Channel, an external boundary: a module of the family, as a real one
// is declared (ADR-0010), that records each notification with its target instead of sending it. Given
// an errorMessage, every send fails with it. createActions takes notificationChannelList in place of the
// registry; saveFor saves it as a Candidate's Channel.
export function createFakeNotificationChannel({ errorMessage }: { errorMessage?: string } = {}) {
  const sentList: ISentNotification[] = [];
  const targetParameter = parameter(z.string(), {
    label: textKeyOf('fakeNotificationChannel', 'targetLabel'),
  });
  const module = defineNotificationChannel({
    id: 'faux',
    name: 'Faux Canal',
    parameterSchema: z.object({ target: targetParameter }),
    send({ target }, notification) {
      if (errorMessage !== undefined) {
        return Promise.reject(new Error(errorMessage));
      }
      sentList.push({ target, ...notification });
      return Promise.resolve();
    },
  });
  return {
    notificationChannelList: [module],
    sentList,
    saveFor: (actions: Actions, candidateId = 'lea', target = LEA_TARGET) =>
      actions.saveNotificationChannel({ candidateId, channel: 'faux', parameters: { target } }),
  };
}
