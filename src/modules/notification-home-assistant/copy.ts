import type { Locale } from '#/domain/index.ts';

// What Home Assistant's failures tell the Candidate, in each locale. It stays in the module's folder,
// the only place allowed to name Home Assistant (ADR-0010).
const COPY_EN = {
  notConfigured:
    'Home Assistant is not configured: enter its address and a long-lived access token in the Notifications section of the Profile.',
  unreachable: (url: string, reason: string) =>
    `Home Assistant unreachable at ${url} (${reason}): check the address of the Notification Channel, and that Home Assistant is running.`,
  tokenRefused: (status: number) =>
    `Home Assistant refused the token (HTTP ${String(status)}): create a long-lived access token (Home Assistant, profile, Security tab) and save it in the Notification Channel.`,
  unexpectedStatus: (status: number) =>
    `Home Assistant answered HTTP ${String(status)}: check that the address of the Notification Channel is that of Home Assistant.`,
  noServiceList: (status: number) =>
    `Home Assistant did not give the list of its services (HTTP ${String(status)}): check that the address of the Notification Channel is that of Home Assistant.`,
  notificationRefused: (service: string, status: number) =>
    `Home Assistant refused the notification to ${service} (HTTP ${String(status)}): check the notification service of the Channel.`,
};

const ADDRESS_ADVICE = "vérifier que l'adresse du Canal de notification est bien celle de Home Assistant.";

const COPY_FR: typeof COPY_EN = {
  notConfigured:
    "Home Assistant n'est pas configuré : saisir son adresse et un jeton d'accès longue durée dans la section Notifications du Profil.",
  unreachable: (url, reason) =>
    `Home Assistant injoignable à ${url} (${reason}) : vérifier l'adresse du Canal de notification, et que Home Assistant tourne.`,
  tokenRefused: (status) =>
    `Home Assistant a refusé le jeton (HTTP ${String(status)}) : créer un jeton d'accès longue durée (Home Assistant, profil, onglet Sécurité) et l'enregistrer dans le Canal de notification.`,
  unexpectedStatus: (status) => `Home Assistant a répondu HTTP ${String(status)} : ${ADDRESS_ADVICE}`,
  noServiceList: (status) =>
    `Home Assistant n'a pas donné la liste de ses services (HTTP ${String(status)}) : ${ADDRESS_ADVICE}`,
  notificationRefused: (service, status) =>
    `Home Assistant a refusé la notification vers ${service} (HTTP ${String(status)}) : vérifier le service de notification du Canal.`,
};

export const COPY_BY_LOCALE: Record<Locale, typeof COPY_EN> = { en: COPY_EN, fr: COPY_FR };
