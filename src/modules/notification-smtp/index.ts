import { z } from 'zod/v4';

import { textKeyOf } from '#/domain/catalogue/i18n.ts';
import { defineNotificationChannel } from '#/notification/index.ts';
import { parameter } from '#/parameter/index.ts';

import { checkLogin, sendEmail } from './acl/smtp.ts';
import { COPY_NAMESPACE } from './copy.ts';

const HOST_PARAMETER = parameter(z.string().min(1), {
  label: textKeyOf(COPY_NAMESPACE, 'hostLabel'),
  placeholder: textKeyOf(COPY_NAMESPACE, 'hostPlaceholder'),
});

// Kept as typed, a string: the front sends it so, and a saved secret stays only with the Parameters
// typed in unchanged (src/actions/notification-channel.ts)
const PORT_PARAMETER = parameter(
  z
    .string()
    .regex(/^\d+$/)
    .refine((port) => Number(port) >= 1 && Number(port) <= 65_535),
  {
    label: textKeyOf(COPY_NAMESPACE, 'portLabel'),
    placeholder: textKeyOf(COPY_NAMESPACE, 'portPlaceholder'),
  },
);

// The login of the mailbox, which sends the e-mails as well
const USER_PARAMETER = parameter(z.email(), {
  label: textKeyOf(COPY_NAMESPACE, 'userLabel'),
  placeholder: textKeyOf(COPY_NAMESPACE, 'userPlaceholder'),
});

const PASSWORD_PARAMETER = parameter(z.string().min(1), {
  label: textKeyOf(COPY_NAMESPACE, 'passwordLabel'),
  placeholder: textKeyOf(COPY_NAMESPACE, 'passwordPlaceholder'),
  isSecret: true,
});

const TO_PARAMETER = parameter(z.email(), {
  label: textKeyOf(COPY_NAMESPACE, 'toLabel'),
  placeholder: textKeyOf(COPY_NAMESPACE, 'toPlaceholder'),
});

// A Notification Channel by e-mail, sent through the SMTP server of the Candidate's own mailbox
// (ADR-0010). The password is write-only (ADR-0006).
export const SMTP = defineNotificationChannel({
  id: 'smtp',
  name: 'E-mail',
  parameterSchema: z.object({
    host: HOST_PARAMETER,
    port: PORT_PARAMETER,
    user: USER_PARAMETER,
    password: PASSWORD_PARAMETER,
    to: TO_PARAMETER,
  }),
  send: sendEmail,
  check: checkLogin,
});
