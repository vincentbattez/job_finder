import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { startFakeSmtpServer } from './fake-smtp-server.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

const LEA_ADDRESS = 'lea.durand@example.org';

// Two Béthune Postings, from the responses recorded on 2026-10-29
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

const BETHUNE_TITLE = 'Attaché de justice affecté auprès des magistrats du siège – Tribunal pour enfants- TJ BETHUNE';

describe('the Detection Summary by e-mail', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Léa reads it in her mailbox: the whole of it, laid out as a page, and as plain text for a mailbox without HTML
  it('goes to the address the Candidate saved, every section in full', async () => {
    const { host, port, user, password, emailList } = await startSmtpServer();
    const dataDirectory = createDataDirectory();
    const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout([REFERENCE, OTHER_REFERENCE]) } });
    const earlierActions = await createActions({ dataDirectory, fetch: earlierFetch.fetch });
    await earlierActions.detect();
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await saveChannel(actions, { host, port, user, password, to: LEA_ADDRESS });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T06:00:00Z'));

    await actions.detect();

    expect(emailList).toHaveLength(1);
    const [email] = emailList;
    expect(email).toMatchObject({ toList: [LEA_ADDRESS], subject: '2 nouvelles Offres' });
    expect(email?.text.split('\n').slice(0, 12)).toEqual([
      'Nouvelles Offres',
      '',
      `• ${BETHUNE_TITLE}`,
      `  Tribunal Judiciaire de Béthune · Date limite : 20/11/2026 · Réf. ${REFERENCE}`,
      `  https://choisirleservicepublic.gouv.fr/offre-emploi/${REFERENCE}/?tracking=1&idOrigine=502`,
      '',
      "• Attaché de justice affecté auprès des magistrats du siège - Service de l'instruction - TJ BETHUNE",
      `  Tribunal Judiciaire de Béthune · Date limite : 20/11/2026 · Réf. ${OTHER_REFERENCE}`,
      `  https://choisirleservicepublic.gouv.fr/offre-emploi/${OTHER_REFERENCE}/?tracking=1&idOrigine=502`,
      '',
      'Détection',
      '',
    ]);
    expect(email?.text).toContain('• Lancée le dimanche 1 novembre 2026 à 07:00\n  par jf detect');
    expect(email?.text).toContain('Veilles\n\n• attaché de justice\n  Place de l’Emploi Public · 2 nouvelles Offres');
    expect(email?.text).toContain('Titres écartés de peu\n\n• Attaché d');
    // Each Posting links to its page at the Source, each title escaped
    expect(email?.html).toContain('<h2');
    expect(email?.html).toContain(
      `<a href="https://choisirleservicepublic.gouv.fr/offre-emploi/${REFERENCE}/?tracking=1&amp;idOrigine=502"`,
    );
    expect(email?.html).toContain('Service de l&#39;instruction');
  });
});
