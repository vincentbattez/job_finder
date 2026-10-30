import { z } from 'zod/v4';

import { defineCanalNotification } from '#/notification/index.ts';
import { parametre } from '#/parametre/index.ts';

import { callNotifyService, checkConnexion, listNotifyServices } from './acl/home-assistant.ts';

const URL_PARAMETRE = parametre(z.url(), {
  label: 'Adresse de Home Assistant',
  type: 'url',
  // On the LAN, Home Assistant serves plain http by default (ADR-0002)
  placeholder: 'http://homeassistant.local:8123',
});

const TOKEN_PARAMETRE = parametre(z.string().min(1), {
  label: 'Jeton d’accès longue durée',
  placeholder: 'Home Assistant → Profil → Sécurité',
  isSecret: true,
});

// One of the notify services of the Home Assistant, such as notify.mobile_app_iphone_de_lea
const SERVICE_PARAMETRE = parametre(z.string().startsWith('notify.'), { label: 'Service de notification' });

// A Canal de notification through the Candidate's own Home Assistant: one of its notify services
// pushes to their phone (ADR-0010). The token is write-only (ADR-0006).
export const HOME_ASSISTANT = defineCanalNotification({
  id: 'home-assistant',
  name: 'Home Assistant',
  parametreSchema: z.object({ url: URL_PARAMETRE, token: TOKEN_PARAMETRE, service: SERVICE_PARAMETRE }),
  send: callNotifyService,
  check: checkConnexion,
  listChoicesByParametre: { service: listNotifyServices },
});
