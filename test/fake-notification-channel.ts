import type { INotification, INotificationChannel } from '#/modules/notification/index.ts';

interface ISentNotification extends INotification {
  target: string | null;
}

// Stands in for the notification channel, an external boundary: records each notification with
// its target, the notify service of the Candidat's Connexion, instead of sending it. Given an errorMessage, every send fails with it.
export function createFakeNotificationChannel({ errorMessage }: { errorMessage?: string } = {}) {
  const sentList: ISentNotification[] = [];
  const channel: INotificationChannel = {
    send({ service: target }, notification) {
      if (errorMessage !== undefined) {
        return Promise.reject(new Error(errorMessage));
      }
      sentList.push({ target, ...notification });
      return Promise.resolve();
    },
  };
  return { ...channel, sentList };
}
