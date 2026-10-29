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

// What the fake Claude writes for each module, whatever the Offre: a Recherche and a Fiche
// d'entretien in their format, and a Lettre whose recipients come from no field of the Offre, so
// they hold for any of them
const FILE_BY_NAME_BY_MODULE: Record<string, Record<string, string>> = {
  // The fields of test/fixtures/import/greffier-grenoble.md, the Fiche de poste e2e/import.test.ts drops
  extraction: {
    'extraction.json': JSON.stringify({
      title: 'Greffier placé – Tribunal judiciaire de Grenoble',
      employer: 'Ministère de la Justice – Tribunal judiciaire de Grenoble',
      workplace: 'Place Firmin Gautier, 38000 Grenoble',
      city: 'Grenoble',
      dateLimite: '2026-12-15',
      applicationEmail: 'greffe.tj-grenoble@justice.fr',
      contact1: null,
      contact2: null,
    }),
  },
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
};

// Long enough for the front to show the Artefact en cours before it is ready
const SESSION_DURATION_MS = 1000;

// A session's module is the Artefact its Version folder belongs to: <offre>/<artefact>/v<n>. The
// extraction of an imported Offre writes in a folder of its own: <offre>/extraction
// (src/modules/source-import).
function moduleOf({ outputDirectory }: IHeadlessSession): string {
  return path.basename(outputDirectory) === 'extraction' ? 'extraction' : path.basename(path.dirname(outputDirectory));
}

const aiSession = {
  ...createFakeAiSession(),
  async runHeadless(session: IHeadlessSession) {
    await setTimeout(SESSION_DURATION_MS);
    const module = moduleOf(session);
    return createFakeAiSession({ fileByName: FILE_BY_NAME_BY_MODULE[module] ?? {} }).runHeadless(session);
  },
};

export const ACTIONS = await createActions({
  dataDirectory,
  aiSession,
  fetch: createRecordedFetch().fetch,
  notificationChannel: createFakeNotificationChannel(),
});
