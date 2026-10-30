import { addResources } from '#/domain/catalogue/i18n.ts';

// What Home Assistant's failures tell the Candidate, in each locale. It stays in the module's folder,
// the only place allowed to name Home Assistant (ADR-0010), as an i18next namespace of its own (ADR-0012).
const COPY_EN = {
  notConfigured:
    'Home Assistant is not configured: enter its address and a long-lived access token in the Notifications section of the Profile.',
  unreachable:
    'Home Assistant unreachable at {{url}} ({{reason}}): check the address of the Notification Channel, and that Home Assistant is running.',
  tokenRefused:
    'Home Assistant refused the token (HTTP {{status}}): create a long-lived access token (Home Assistant, profile, Security tab) and save it in the Notification Channel.',
  unexpectedStatus:
    'Home Assistant answered HTTP {{status}}: check that the address of the Notification Channel is that of Home Assistant.',
  noServiceList:
    'Home Assistant did not give the list of its services (HTTP {{status}}): check that the address of the Notification Channel is that of Home Assistant.',
  notificationRefused:
    'Home Assistant refused the notification to {{service}} (HTTP {{status}}): check the notification service of the Channel.',
};

const ADDRESS_ADVICE = "vérifier que l'adresse du Canal de notification est bien celle de Home Assistant.";

const COPY_FR: typeof COPY_EN = {
  notConfigured:
    "Home Assistant n'est pas configuré : saisir son adresse et un jeton d'accès longue durée dans la section Notifications du Profil.",
  unreachable:
    "Home Assistant injoignable à {{url}} ({{reason}}) : vérifier l'adresse du Canal de notification, et que Home Assistant tourne.",
  tokenRefused:
    "Home Assistant a refusé le jeton (HTTP {{status}}) : créer un jeton d'accès longue durée (Home Assistant, profil, onglet Sécurité) et l'enregistrer dans le Canal de notification.",
  unexpectedStatus: `Home Assistant a répondu HTTP {{status}} : ${ADDRESS_ADVICE}`,
  noServiceList: `Home Assistant n'a pas donné la liste de ses services (HTTP {{status}}) : ${ADDRESS_ADVICE}`,
  notificationRefused:
    'Home Assistant a refusé la notification vers {{service}} (HTTP {{status}}) : vérifier le service de notification du Canal.',
};

export const COPY_NAMESPACE = 'notificationHomeAssistant';

// The t function of the namespace checks its keys against the en copy
declare module 'i18next' {
  interface ResourceNamespaceMap {
    notificationHomeAssistant: typeof COPY_EN;
  }
}

addResources(COPY_NAMESPACE, { en: COPY_EN, fr: COPY_FR });
