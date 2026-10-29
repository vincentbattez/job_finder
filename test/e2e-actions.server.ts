import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { createActions } from '#/actions/index.ts';
import type { IHeadlessSession } from '#/ai-session/acl/claude-code.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch } from './recorded-http.ts';

// In the e2e tests, vite.config.ts serves this module in place of src/web/acl/actions.server.ts, and
// test/e2e-worker.ts runs its queued jobs: the front and the worker work on the temporary data
// folder of playwright.config.ts, with the fakes of the external boundaries. No real Claude
// session, no real site, no real notification.
const dataDirectory = process.env.JF_DATA_DIRECTORY ?? '';
if (!dataDirectory.startsWith(tmpdir())) {
  throw new Error(`JF_DATA_DIRECTORY doit être un dossier temporaire, pas « ${dataDirectory} ».`);
}

// What the fake Claude writes for each module, whatever the Offre: a Recherche, a Fiche
// d'entretien and its Visualisation in their format, and a Lettre whose recipients come from no
// field of the Offre, so they hold for any of them
const FILE_BY_NAME_BY_MODULE: Record<string, Record<string, string>> = {
  recherche: { 'recherche.md': '# Recherche factice\n\n## Sources\n\n- https://www.justice.fr/\n' },
  lettre: {
    'brouillon.md':
      'Madame, Monsieur,\n\nTitulaire d’un [à compléter : diplôme], je souhaite rejoindre votre juridiction.\n',
    'destinataires.json': JSON.stringify({
      to: null,
      ccList: [],
      salutation: { text: 'Madame, Monsieur,', source: null },
      justification: 'Aucun champ de l’Offre ne donne d’adresse.',
    }),
  },
  fiche_entretien: {
    'fiche-entretien.md': [
      '# Fiche d’entretien factice',
      '## À réviser\n\n- Les missions du poste.',
      '## Moyens mnémotechniques\n\n- « MPS » : Missions, Partenaires, Service.',
      '## Présentez-vous\n\nTitulaire d’un [à compléter : diplôme], je souhaite rejoindre votre juridiction.',
      '## Questions probables\n\n- Pourquoi ce poste ?\n',
    ].join('\n\n'),
  },
  visualisation: {
    'visualisation.html': [
      '<!DOCTYPE html>',
      '<html lang="fr"><head><meta charset="utf-8"><title>Fiche d’entretien factice</title></head><body>',
      '<h1>Fiche d’entretien factice</h1>',
      '<table><tr><th>MPS</th><td>Missions, Partenaires, Service</td></tr></table>',
      '</body></html>\n',
    ].join('\n'),
  },
};

// Long enough for the front to show the Artefact en cours before it is ready
const SESSION_DURATION_MS = 1000;

// A session's module is the Artefact its Version folder belongs to: <offre>/<artefact>/v<n>
const aiSession = {
  ...createFakeAiSession(),
  async runHeadless(session: IHeadlessSession) {
    await setTimeout(SESSION_DURATION_MS);
    const module = path.basename(path.dirname(session.outputDirectory));
    return createFakeAiSession({ fileByName: FILE_BY_NAME_BY_MODULE[module] ?? {} }).runHeadless(session);
  },
};

export const ACTIONS = await createActions({
  dataDirectory,
  aiSession,
  fetch: createRecordedFetch().fetch,
  notificationChannel: createFakeNotificationChannel(),
});
