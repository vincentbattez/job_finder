import { describe, expect, it, onTestFinished } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { startFakeSmtpServer } from './fake-smtp-server.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

const LEA_ADDRESS = 'lea.durand@example.org';

// Two Béthune Postings in Léa's Zone, from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OTHER_REFERENCE = '2026-2445609';

async function startSmtpServer() {
  const smtpServer = await startFakeSmtpServer();
  onTestFinished(() => smtpServer.close());
  return smtpServer;
}

async function openActions() {
  return createActions({ dataDirectory: createDataDirectory(), fetch: createRecordedFetch().fetch });
}

// The e-mail Notification Channel, through the generic actions of the family (ADR-0010)
function saveChannel(actions: Actions, parameters: object) {
  return actions.saveNotificationChannel({ candidateId: 'lea', channel: 'smtp', parameters });
}

function testChannel(actions: Actions, parameters: object = {}) {
  return actions.testNotificationChannel({ candidateId: 'lea', parameters });
}

describe('the e-mail Notification Channel of a Candidate', () => {
  it('is one of the Channels offered, with its server, its write-only password and the address to notify', async () => {
    const actions = await openActions();

    expect(await actions.listNotificationChannels()).toContainEqual(
      expect.objectContaining({
        id: 'smtp',
        name: 'E-mail',
        isTestable: true,
        parameterList: [
          expect.objectContaining({ name: 'host', label: 'notificationSmtp:hostLabel', isRequired: true }),
          expect.objectContaining({ name: 'port', isRequired: true, isSecret: false }),
          expect.objectContaining({ name: 'user', isRequired: true, isSecret: false }),
          expect.objectContaining({ name: 'password', isRequired: true, isSecret: true }),
          expect.objectContaining({ name: 'to', isRequired: true, isSecret: false, hasChoices: false }),
        ],
      }),
    );
  });

  it('sends a test notification as an e-mail to the address it saved', async () => {
    const { host, port, user, password, emailList } = await startSmtpServer();
    const actions = await openActions();
    await saveChannel(actions, { host, port, user, password, to: LEA_ADDRESS });

    await actions.sendTestNotification({ candidateId: 'lea' });

    expect(emailList).toEqual([
      {
        from: user,
        toList: [LEA_ADDRESS],
        subject: 'Notification de test',
        text: 'Le Canal de notification de Léa fonctionne.',
      },
    ]);
  });

  it('logs in to the SMTP server whose address and password it saved', async () => {
    const { host, port, user, password, emailList } = await startSmtpServer();
    const actions = await openActions();
    await saveChannel(actions, { host, port, user, password, to: LEA_ADDRESS });

    await expect(testChannel(actions)).resolves.toBeUndefined();
    expect(emailList).toEqual([]);
  });

  it('tells the Candidate to check a password the SMTP server refuses', async () => {
    const { host, port, user } = await startSmtpServer();
    const actions = await openActions();
    await saveChannel(actions, { host, port, user, password: 'mot-de-passe-révoqué', to: LEA_ADDRESS });

    await expect(testChannel(actions)).rejects.toThrow(
      /Le serveur SMTP a refusé l'identifiant lea@example.org .* vérifier l'identifiant et le mot de passe/,
    );
  });

  it('tells the Candidate to check the server and the port of an SMTP server it cannot reach', async () => {
    const { host, port, user, password, close } = await startSmtpServer();
    await close();
    const actions = await openActions();
    await saveChannel(actions, { host, port, user, password, to: LEA_ADDRESS });

    await expect(testChannel(actions)).rejects.toThrow(
      new RegExp(`Serveur SMTP injoignable à localhost:${port} .* vérifier le serveur et le port`),
    );
  });

  it('tells the Candidate to check an address to notify the SMTP server refuses', async () => {
    const { host, port, user, password } = await startSmtpServer();
    const actions = await openActions();
    await saveChannel(actions, { host, port, user, password, to: 'lea@example.invalid' });

    await expect(actions.sendTestNotification({ candidateId: 'lea' })).rejects.toThrow(
      /Le serveur SMTP a refusé l'e-mail de lea@example.org vers lea@example.invalid .* vérifier l'adresse d'envoi et l'adresse à notifier/,
    );
  });

  it('reads back its server and addresses, and only whether a password is configured', async () => {
    const { host, port, user, password } = await startSmtpServer();
    const actions = await openActions();
    await saveChannel(actions, { host, port, user, password, to: LEA_ADDRESS });

    expect(await actions.readNotificationChannel({ candidateId: 'lea' })).toEqual({
      module: 'smtp',
      parameters: { host, port, user, to: LEA_ADDRESS },
      configuredSecretList: ['password'],
    });
  });

  // Anyone on the LAN reaches the front (ADR-0002): the saved password goes to the saved server only
  it('never sends the saved password to a server given without a password', async () => {
    const { host, port, user, password } = await startSmtpServer();
    const other = await startSmtpServer();
    const actions = await openActions();
    await saveChannel(actions, { host, port, user, password, to: LEA_ADDRESS });

    await expect(testChannel(actions, { port: other.port })).rejects.toThrow(/Le Canal E-mail n'est pas configuré/);

    expect(other.loginList).toEqual([]);
    await expect(testChannel(actions, { port })).resolves.toBeUndefined();
  });
});

describe('the notification of a new Posting by e-mail', () => {
  it('goes to the address the Candidate saved', async () => {
    const { host, port, user, password, emailList } = await startSmtpServer();
    const dataDirectory = createDataDirectory();
    const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout([REFERENCE, OTHER_REFERENCE]) } });
    const earlierActions = await createActions({ dataDirectory, fetch: earlierFetch.fetch });
    await earlierActions.detect();
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await saveChannel(actions, { host, port, user, password, to: LEA_ADDRESS });

    await actions.detect();

    expect(emailList.map(({ toList, subject }) => ({ toList, subject }))).toEqual([
      { toList: [LEA_ADDRESS], subject: 'Nouvelle Offre dans la Zone' },
      { toList: [LEA_ADDRESS], subject: 'Nouvelle Offre dans la Zone' },
    ]);
  });
});
