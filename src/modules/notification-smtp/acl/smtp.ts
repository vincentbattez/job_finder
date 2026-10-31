import { createTransport } from 'nodemailer';

import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import type { Locale } from '#/domain/index.ts';
import { COPY_NAMESPACE } from '#/modules/notification-smtp/copy.ts';
import type { INotification } from '#/notification/index.ts';
import { messageOf } from '#/text/index.ts';

// What reaching the SMTP server takes. A test tries what the Candidate typed, so each may be missing
// there.
interface IAccess {
  host?: string | undefined;
  port?: string | undefined;
  user?: string | undefined;
  password?: string | undefined;
}

// A server that never answers would hold the Detection or the job that notifies: past this, it is
// unreachable
const TIMEOUT_MS = 10_000;

// How nodemailer tells the server refused the login, or the e-mail (its sender, its recipient or its
// content), rather than could not be reached
const AUTH_ERROR_CODE = 'EAUTH';
const REFUSED_EMAIL_CODE_SET = new Set(['EENVELOPE', 'EMESSAGE']);

function codeOf(error: unknown): unknown {
  return error instanceof Error && 'code' in error ? error.code : undefined;
}

// Every exchange with the SMTP server, whose failures say what to do; the password never appears in
// a message, which reaches the front (ADR-0006). Port 465 speaks TLS from the start, any other
// upgrades with STARTTLS when the server offers it.
async function exchange(
  { host, port, user, password, to }: IAccess & { to?: string },
  locale: Locale,
  run: (transport: ReturnType<typeof createTransport>, user: string) => Promise<unknown>,
): Promise<void> {
  const t = tFor(locale, COPY_NAMESPACE);
  if (host === undefined || port === undefined || user === undefined || password === undefined) {
    throw codedError('channel_not_configured', { detail: t('notConfigured') }, { locale });
  }
  const transport = createTransport({
    host,
    port: Number(port),
    auth: { user, pass: password },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
    dnsTimeout: TIMEOUT_MS,
  });
  try {
    await run(transport, user);
  } catch (error) {
    if (REFUSED_EMAIL_CODE_SET.has(String(codeOf(error)))) {
      throw codedError(
        'channel_status',
        { detail: t('emailRefused', { user, to, reason: messageOf(error) }) },
        { locale, cause: error },
      );
    }
    if (codeOf(error) === AUTH_ERROR_CODE) {
      throw codedError(
        'channel_token_refused',
        { detail: t('passwordRefused', { user, reason: messageOf(error) }) },
        { locale, cause: error },
      );
    }
    throw codedError(
      'channel_unreachable',
      { detail: t('unreachable', { host, port, reason: messageOf(error) }) },
      { locale, cause: error },
    );
  } finally {
    transport.close();
  }
}

// Before the Candidate relies on it: a wrong server or password fails here rather than on a new
// Posting
export async function checkLogin(access: IAccess, locale: Locale): Promise<void> {
  await exchange(access, locale, (transport) => transport.verify());
}

// The notification as a plain-text e-mail, from the mailbox to the address to notify
export async function sendEmail(
  access: IAccess & { to: string },
  { title, message }: INotification,
  locale: Locale,
): Promise<void> {
  await exchange(access, locale, (transport, user) =>
    transport.sendMail({ from: user, to: access.to, subject: title, text: message }),
  );
}
