import type { Readable } from 'node:stream';

import { simpleParser } from 'mailparser';
import { SMTPServer, type SMTPServerEnvelope } from 'smtp-server';

// The only login the fake accepts, an address the sender of the e-mails as well
const FAKE_SMTP_USER = 'lea@example.org';
const FAKE_SMTP_PASSWORD = 'mot-de-passe-du-faux-smtp';

interface IReceivedEmail {
  from: string;
  toList: string[];
  subject: string;
  text: string;
  // Its HTML part, which only an e-mail laid out as a page has
  html?: string;
}

// Stands in for the SMTP server of the Candidate's mailbox, an external boundary: on a free port,
// without TLS, it accepts the one login above, refuses any address of the .invalid domain, and records
// the e-mails it receives
export async function startFakeSmtpServer() {
  const emailList: IReceivedEmail[] = [];
  // Every login tried on it, to check where a password went
  const loginList: string[] = [];

  // Answers the client once the e-mail is recorded, or refuses one it cannot read
  async function receive(
    stream: Readable,
    { mailFrom, rcptTo: recipientList }: SMTPServerEnvelope,
    callback: (error?: Error) => void,
  ) {
    try {
      const { subject = '', text = '', html } = await simpleParser(stream);
      emailList.push({
        from: mailFrom === false ? '' : mailFrom.address,
        toList: recipientList.map(({ address }) => address),
        subject,
        text: text.trimEnd(),
        ...(html !== false && { html }),
      });
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }

  const server = new SMTPServer({
    disabledCommands: ['STARTTLS'],
    allowInsecureAuth: true,
    onAuth({ username = '', password = '' }, session, callback) {
      loginList.push(username);
      if (username === FAKE_SMTP_USER && password === FAKE_SMTP_PASSWORD) {
        callback(null, { user: username });
      } else {
        callback(new Error('535 Authentication failed'));
      }
    },
    // A mailbox that does not exist, as a server answers it
    onRcptTo({ address }, session, callback) {
      callback(address.endsWith('.invalid') ? new Error('550 No such user') : undefined);
    },
    onData(stream, { envelope }, callback) {
      void receive(stream, envelope, callback);
    },
  });
  await new Promise<void>((resolve) => {
    server.listen(0, 'localhost', resolve);
  });
  const address = server.server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The fake SMTP server listens on no TCP port.');
  }

  return {
    host: 'localhost',
    port: String(address.port),
    user: FAKE_SMTP_USER,
    password: FAKE_SMTP_PASSWORD,
    emailList,
    loginList,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(resolve);
      }),
  };
}
