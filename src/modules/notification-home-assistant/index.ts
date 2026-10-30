import { z } from 'zod/v4';

import { textKeyOf } from '#/domain/catalogue/i18n.ts';
import { defineNotificationChannel } from '#/notification/index.ts';
import { parameter } from '#/parameter/index.ts';

import { callNotifyService, checkConnection, listNotifyServices } from './acl/home-assistant.ts';
import { COPY_NAMESPACE } from './copy.ts';

const URL_PARAMETER = parameter(z.url(), {
  label: textKeyOf(COPY_NAMESPACE, 'urlLabel'),
  type: 'url',
  placeholder: textKeyOf(COPY_NAMESPACE, 'urlPlaceholder'),
});

const TOKEN_PARAMETER = parameter(z.string().min(1), {
  label: textKeyOf(COPY_NAMESPACE, 'tokenLabel'),
  placeholder: textKeyOf(COPY_NAMESPACE, 'tokenPlaceholder'),
  isSecret: true,
});

// One of the notify services of the Home Assistant, such as notify.mobile_app_iphone_de_lea
const SERVICE_PARAMETER = parameter(z.string().startsWith('notify.'), {
  label: textKeyOf(COPY_NAMESPACE, 'serviceLabel'),
});

// A Notification Channel through the Candidate's own Home Assistant: one of its notify services
// pushes to their phone (ADR-0010). The token is write-only (ADR-0006).
export const HOME_ASSISTANT = defineNotificationChannel({
  id: 'home-assistant',
  name: 'Home Assistant',
  parameterSchema: z.object({ url: URL_PARAMETER, token: TOKEN_PARAMETER, service: SERVICE_PARAMETER }),
  send: callNotifyService,
  check: checkConnection,
  listChoicesByParameter: { service: listNotifyServices },
});
