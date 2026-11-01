import { addResources } from '#/domain/catalogue/i18n.ts';

// What the e-mail Channel tells the Candidate, in each locale: its failures and the texts of its
// Parameters. It stays in the module's folder, the only place allowed to name SMTP (ADR-0010), as an
// i18next namespace of its own (ADR-0012).
const COPY_EN = {
  notConfigured:
    'The e-mail Channel is not configured: enter its SMTP server, login and password in the Notifications section of the Profile.',
  unreachable:
    'SMTP server unreachable at {{host}}:{{port}} ({{reason}}): check the server and the port of the Notification Channel.',
  passwordRefused:
    'The SMTP server refused the login {{user}} ({{reason}}): check the login and the password of the Notification Channel, an app password for Gmail.',
  emailRefused:
    'The SMTP server refused the e-mail from {{user}} to {{to}} ({{reason}}): check the sender address and the address to notify of the Notification Channel.',
  hostLabel: 'SMTP server',
  hostPlaceholder: 'smtp.gmail.com',
  portLabel: 'SMTP port',
  // 465 speaks TLS from the start, the safest default with the common mailboxes
  portPlaceholder: '465',
  userLabel: 'Sender address (SMTP login)',
  userPlaceholder: 'lea.durand@gmail.com',
  passwordLabel: 'SMTP password',
  passwordPlaceholder: 'An app password of the mailbox',
  toLabel: 'Address to notify',
  toPlaceholder: 'lea.durand@example.org',
};

const COPY_FR: typeof COPY_EN = {
  notConfigured:
    "Le Canal E-mail n'est pas configuré : saisir son serveur SMTP, son identifiant et son mot de passe dans la section Notifications du Profil.",
  unreachable:
    'Serveur SMTP injoignable à {{host}}:{{port}} ({{reason}}) : vérifier le serveur et le port du Canal de notification.',
  passwordRefused:
    "Le serveur SMTP a refusé l'identifiant {{user}} ({{reason}}) : vérifier l'identifiant et le mot de passe du Canal de notification, un mot de passe d'application pour Gmail.",
  emailRefused:
    "Le serveur SMTP a refusé l'e-mail de {{user}} vers {{to}} ({{reason}}) : vérifier l'adresse d'envoi et l'adresse à notifier du Canal de notification.",
  hostLabel: 'Serveur SMTP',
  hostPlaceholder: 'smtp.gmail.com',
  portLabel: 'Port SMTP',
  portPlaceholder: '465',
  userLabel: "Adresse d'envoi (identifiant SMTP)",
  userPlaceholder: 'lea.durand@gmail.com',
  passwordLabel: 'Mot de passe SMTP',
  passwordPlaceholder: "Un mot de passe d'application de la messagerie",
  toLabel: 'Adresse à notifier',
  toPlaceholder: 'lea.durand@example.org',
};

export const COPY_NAMESPACE = 'notificationSmtp';

// The t function of the namespace checks its keys against the en copy
declare module 'i18next' {
  interface ResourceNamespaceMap {
    notificationSmtp: typeof COPY_EN;
  }
}

addResources(COPY_NAMESPACE, { en: COPY_EN, fr: COPY_FR });
