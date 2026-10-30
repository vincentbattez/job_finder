import type { HomeAssistantAccess, Offre } from '#/domain/index.ts';

import { callNotifyService } from './acl/home-assistant.ts';

export { checkConnexion, listNotifyServices } from './acl/home-assistant.ts';

// What the Candidat reads on their phone
export interface INotification {
  title: string;
  message: string;
}

// The channels are interchangeable, each Candidat with their own Connexion (ADR-0003, ADR-0006)
export interface INotificationChannel {
  send(access: HomeAssistantAccess, notification: INotification): Promise<void>;
}

// The only channel of the v0: a notify service of the Candidat's Home Assistant
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

// One composer per notified event
export function composeNouvelleOffreNotification(offre: Offre): INotification {
  return {
    title: 'Nouvelle Offre dans la Zone',
    message: [offre.title, juridictionOf(offre), dateLimiteOf(offre)].join('\n'),
  };
}

// A Republication in the Zone, whose Recherche starts from that of the Offre it publishes again
export function composeRepublicationNotification(offre: Offre, republishedOffre: Offre): INotification {
  return {
    title: 'Republication dans la Zone',
    message: [
      offre.title,
      juridictionOf(offre),
      `Republication de l'Offre ${republishedOffre.reference} : sa Recherche part de celle de cette Offre`,
      dateLimiteOf(offre),
    ].join('\n'),
  };
}

// The Candidat already applied to the Offre published again: they decide whether to apply again
export function composeRepublicationPostuleeNotification(offre: Offre, republishedOffre: Offre): INotification {
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

// What the Candidat receives when they try their Connexion Home Assistant
export function composeTestNotification(candidatName: string): INotification {
  return { title: 'Notification de test', message: `La Connexion Home Assistant de ${candidatName} fonctionne.` };
}

export function composeRecherchePreteNotification(offre: Offre): INotification {
  return { title: 'Recherche prête', message: [offre.title, juridictionOf(offre)].join('\n') };
}
