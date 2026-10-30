import type { NOTIFICATION_EN } from '#/domain/catalogue/en/notification.ts';

const DEADLINE_FORMAT = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });

const quote = (text: string) => `« ${text} »`;

export const NOTIFICATION_FR: typeof NOTIFICATION_EN = {
  missingJurisdiction: 'Juridiction non précisée',
  deadline: (deadline) => `Date limite : ${deadline === null ? 'non précisée' : DEADLINE_FORMAT.format(deadline)}`,
  newPostingTitle: 'Nouvelle Offre dans la Zone',
  repostTitle: 'Republication dans la Zone',
  repostLine: (repostedReference) =>
    `Republication de l'Offre ${repostedReference} : sa Recherche part de celle de cette Offre`,
  repostAppliedTitle: "Republication d'une Offre Postulée",
  repostAppliedLine: (repostedReference) =>
    `Republication de l'Offre ${repostedReference}, Postulée : aucune Recherche lancée`,
  testTitle: 'Notification de test',
  testMessage: (candidateName) => `Le Canal de notification de ${candidateName} fonctionne.`,
  researchReadyTitle: 'Recherche prête',
  notSent: (title, reference, reason) => `Notification « ${title} » de l'Offre ${reference} non envoyée : ${reason}`,
  incompleteChannel: (channelName, labelList) =>
    `Le Canal de notification ${channelName} est incomplet : renseigner ${labelList.map((label) => quote(label)).join(', ')} dans la section Notifications du Profil.`,
  untestableChannel: (channelName) =>
    `Le Canal de notification ${channelName} ne se teste pas : envoyer une notification de test.`,
  noChoices: (parameterLabel, channelName) =>
    `Le Paramètre ${parameterLabel} du Canal ${channelName} n'a pas de choix à lister.`,
  noChannel: (candidateName) =>
    `Aucun Canal de notification pour ${candidateName} : en choisir un dans la section Notifications de son Profil.`,
  unknownChannel: (moduleId) =>
    `Canal de notification inconnu : ${moduleId}. En choisir un autre dans la section Notifications du Profil.`,
};
