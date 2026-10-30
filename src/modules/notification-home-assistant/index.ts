import { z } from 'zod/v4';

import { defineNotificationChannel } from '#/notification/index.ts';
import { parameter } from '#/parameter/index.ts';

import { callNotifyService, checkConnexion, listNotifyServices } from './acl/home-assistant.ts';

const URL_PARAMETER = parameter(z.url(), {
  label: 'Adresse de Home Assistant',
  type: 'url',
  // On the LAN, Home Assistant serves plain http by default (ADR-0002)
  placeholder: 'http://homeassistant.local:8123',
});

const TOKEN_PARAMETER = parameter(z.string().min(1), {
  label: 'Jeton d’accès longue durée',
  placeholder: 'Home Assistant → Profil → Sécurité',
  isSecret: true,
});

// One of the notify services of the Home Assistant, such as notify.mobile_app_iphone_de_lea
const SERVICE_PARAMETER = parameter(z.string().startsWith('notify.'), { label: 'Service de notification' });

// A Notification Channel through the Candidate's own Home Assistant: one of its notify services
// pushes to their phone (ADR-0010). The token is write-only (ADR-0006).
export const HOME_ASSISTANT = defineNotificationChannel({
  id: 'home-assistant',
  name: 'Home Assistant',
  parameterSchema: z.object({ url: URL_PARAMETER, token: TOKEN_PARAMETER, service: SERVICE_PARAMETER }),
  send: callNotifyService,
  check: checkConnexion,
  listChoicesByParameter: { service: listNotifyServices },
});
