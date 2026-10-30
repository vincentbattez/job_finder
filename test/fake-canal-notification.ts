import { z } from 'zod/v4';

import type { Actions } from '#/actions/index.ts';
import { defineCanalNotification, type INotification } from '#/notification/index.ts';
import { parametre } from '#/parametre/index.ts';

interface ISentNotification extends INotification {
  target: string;
}

// Léa's phone, the target of the fake Canal the tests save for her
export const LEA_TARGET = 'notify.mobile_app_iphone_de_lea';

// Stands in for the Canal de notification, an external boundary: a module of the family, as a real one
// is declared (ADR-0010), that records each notification with its target instead of sending it. Given
// an errorMessage, every send fails with it. createActions takes canalNotificationList in place of the
// registry; saveFor saves it as a Candidat's Canal.
export function createFakeCanalNotification({ errorMessage }: { errorMessage?: string } = {}) {
  const sentList: ISentNotification[] = [];
  const targetParametre = parametre(z.string(), { label: 'Cible' });
  const module = defineCanalNotification({
    id: 'faux',
    name: 'Faux Canal',
    parametreSchema: z.object({ target: targetParametre }),
    send({ target }, notification) {
      if (errorMessage !== undefined) {
        return Promise.reject(new Error(errorMessage));
      }
      sentList.push({ target, ...notification });
      return Promise.resolve();
    },
  });
  return {
    canalNotificationList: [module],
    sentList,
    saveFor: (actions: Actions, candidatId = 'lea', target = LEA_TARGET) =>
      actions.saveCanalNotification({ candidatId, canal: 'faux', parametres: { target } }),
  };
}
