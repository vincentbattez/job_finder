import type { Offre } from '#/domain/index.ts';

import { callNotifyService } from './acl/home-assistant.ts';

// What the Candidat reads on their phone
export interface INotification {
  title: string;
  message: string;
}

// The channels are interchangeable, and each Candidat has their own (ADR-0003): the target is
// where that Candidat receives the notifications, as the config names it. The tests replace the
// channel with a fake.
export interface INotificationChannel {
  send(target: string, notification: INotification): Promise<void>;
}

// The only channel of the v0: the target is a notify service of Home Assistant
export const HOME_ASSISTANT: INotificationChannel = { send: callNotifyService };

// The Source gives the Date limite as a day, at midnight UTC
const DATE_LIMITE_FORMAT = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });

// The juridiction of an Offre is its workplace, such as « Tribunal Judiciaire de Béthune »
function juridictionOf({ workplace }: Offre): string {
  return workplace ?? 'Juridiction non précisée';
}

function dateLimiteOf({ dateLimite }: Offre): string {
  return `Date limite : ${dateLimite === null ? 'non précisée' : DATE_LIMITE_FORMAT.format(dateLimite)}`;
}

// One composer per notified event (spec « Notification »)
export function composeNouvelleOffreNotification(offre: Offre): INotification {
  return {
    title: 'Nouvelle Offre dans la Zone',
    message: [offre.title, juridictionOf(offre), dateLimiteOf(offre)].join('\n'),
  };
}

// The Candidat already applied to the Offre published again: they decide whether to apply again
export function composeRepublicationNotification(offre: Offre, republishedOffre: Offre): INotification {
  return {
    title: "Republication d'une Offre Postulée",
    message: [
      offre.title,
      juridictionOf(offre),
      `Republication de l'Offre ${republishedOffre.reference}, Postulée : aucune Recherche lancée`,
      dateLimiteOf(offre),
    ].join('\n'),
  };
}

export function composeRecherchePreteNotification(offre: Offre): INotification {
  return { title: 'Recherche prête', message: [offre.title, juridictionOf(offre)].join('\n') };
}
