import type { NOTIFICATION_EN } from '#/domain/catalogue/en/notification.ts';

export const NOTIFICATION_FR: typeof NOTIFICATION_EN = {
  missingJurisdiction: 'Juridiction non précisée',
  deadline: 'Date limite : {{deadline, datetime(timeZone: UTC)}}',
  noDeadline: 'Date limite : non précisée',
  newPostingTitle: 'Nouvelle Offre dans la Zone',
  repostTitle: 'Republication dans la Zone',
  repostLine: "Republication de l'Offre {{repostedReference}} : sa Recherche part de celle de cette Offre",
  repostAppliedTitle: "Republication d'une Offre Postulée",
  repostAppliedLine: "Republication de l'Offre {{repostedReference}}, Postulée : aucune Recherche lancée",
  testTitle: 'Notification de test',
  testMessage: 'Le Canal de notification de {{candidateName}} fonctionne.',
  researchReadyTitle: 'Recherche prête',
  notSent: "Notification « {{title}} » de l'Offre {{reference}} non envoyée : {{reason}}",
  quote: '« {{text}} »',
  incompleteChannel:
    'Le Canal de notification {{channelName}} est incomplet : renseigner {{labels}} dans la section Notifications du Profil.',
  untestableChannel: 'Le Canal de notification {{channelName}} ne se teste pas : envoyer une notification de test.',
  noChoices: "Le Paramètre {{parameterLabel}} du Canal {{channelName}} n'a pas de choix à lister.",
  noChannel:
    'Aucun Canal de notification pour {{candidateName}} : en choisir un dans la section Notifications de son Profil.',
  unknownChannel:
    'Canal de notification inconnu : {{moduleId}}. En choisir un autre dans la section Notifications du Profil.',
};
