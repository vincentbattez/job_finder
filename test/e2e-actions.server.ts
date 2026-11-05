import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { createActions } from '#/actions/index.ts';
import { SOURCE_LIST } from '#/actions/modules.ts';
import type { IHeadlessSession } from '#/ai-session/acl/claude-code.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { defineSlowSource } from './fake-slow-source.ts';
import { createRecordedFetch } from './recorded-http.ts';

// In the e2e tests, vite.config.ts serves this module in place of src/web/acl/actions.server.ts, and
// test/e2e-worker.ts runs its queued jobs: the front and the worker work on the temporary data
// folder of playwright.config.ts, with the fakes of the external boundaries. No real Claude
// session, no real site (the PEP's recorded responses, and a slow fake Source), no real notification: test/seed-front.ts saves the Notification Channels
// through the fake Home Assistant of playwright.config.ts.
const dataDirectory = process.env.JF_DATA_DIRECTORY ?? '';
if (!dataDirectory.startsWith(tmpdir())) {
  throw new Error(`JF_DATA_DIRECTORY doit être un dossier temporaire, pas « ${dataDirectory} ».`);
}

// What the fake Claude writes for each module, whatever the Posting: a Research, a Portrait and an
// Interview Brief in their format, and a Letter whose recipients come from no
// field of the Posting, so they hold for any of them
const FILE_BY_NAME_BY_MODULE: Record<string, Record<string, string>> = {
  // The fields of the Grenoble Job Description of test/fixtures/import/, the one e2e/import.test.ts drops
  extraction: {
    'extraction.json': JSON.stringify({
      title: 'Greffier placé – Tribunal judiciaire de Grenoble',
      employer: 'Ministère de la Justice – Tribunal judiciaire de Grenoble',
      workplace: 'Place Firmin Gautier, 38000 Grenoble',
      city: 'Grenoble',
      deadline: '2026-12-15',
      startDate: null,
      applicationEmail: 'greffe.tj-grenoble@justice.fr',
      contact1: null,
      contact2: null,
    }),
  },
  research: { 'research.md': '# Recherche factice\n\n## Sources\n\n- https://www.justice.fr/\n' },
  letter: {
    'letter.md':
      'Madame, Monsieur,\n\nTitulaire d’un [à compléter : diplôme], je souhaite rejoindre votre juridiction.\n',
    'recipients.json': JSON.stringify({
      to: null,
      ccList: [],
      salutation: { text: 'Madame, Monsieur,', source: null },
      justification: 'Aucun champ de l’Offre ne donne d’adresse.',
    }),
  },
  portrait: {
    'portrait.md': '# Portrait factice\n\nMme Durand, juge des enfants ([justice.fr](https://www.justice.fr/)).\n',
  },
  interview_brief: {
    'interview-brief.md': [
      '# Fiche d’entretien factice',
      '## À réviser\n\n- Les missions du poste.',
      '## Moyens mnémotechniques\n\n- « MPS » : Missions, Partenaires, Service.',
      '## Présentez-vous\n\nTitulaire d’un [à compléter : diplôme], je souhaite rejoindre votre juridiction.',
      '## Questions probables\n\n- Pourquoi ce poste ?\n',
    ].join('\n\n'),
  },
  // The CV that e2e/profile.test.ts drops, test/fixtures/profile/cv.pdf
  conversion: { 'cv.md': '# CV converti\n\n## Formation\n\n- Master 2 droit public\n' },
};

// Long enough for the front to show the Artifact in progress before it is ready
const SESSION_DURATION_MS = 300;
// e2e/profile.test.ts reads the status of a conversion in progress, on a page that has to come back first
const CONVERSION_DURATION_MS = 1000;
// A test that needs a Detection in progress holds it (test/fake-slow-source.ts), so these only spread its
// steps: e2e/detection.test.ts keeps within its time budget
const SLOW_SOURCE_DELAYS = {
  searchMs: 100,
  readMs: 5,
  holdFilePath: process.env.E2E_DETECTION_HOLD_PATH,
};

// A session's module is the Artifact its Version folder belongs to: <posting>/<artifact>/v<n>, or
// <posting>/interviews/<number>/<artifact>/v<n> for an Artifact of an Interview. The
// extraction of an imported Posting writes in a folder of its own, <posting>/extraction
// (src/modules/source-import), and the conversion of an Upload in profile/uploads/.conversion/<upload>
// (src/workspace).
function moduleOf({ outputDirectory }: IHeadlessSession): string {
  if (path.basename(outputDirectory) === 'extraction') {
    return 'extraction';
  }
  const parentName = path.basename(path.dirname(outputDirectory));
  return parentName === '.conversion' ? 'conversion' : parentName;
}

const aiSession = {
  ...createFakeAiSession(),
  async runHeadless(session: IHeadlessSession) {
    const module = moduleOf(session);
    await setTimeout(module === 'conversion' ? CONVERSION_DURATION_MS : SESSION_DURATION_MS);
    return createFakeAiSession({ fileByName: FILE_BY_NAME_BY_MODULE[module] ?? {} }).runHeadless(session);
  },
};

export const ACTIONS = await createActions({
  dataDirectory,
  aiSession,
  fetch: createRecordedFetch().fetch,
  // The slow fake Source beside the registry: the Watches of e2e/detection.test.ts follow it
  sourceFactoryList: [...SOURCE_LIST, defineSlowSource(SLOW_SOURCE_DELAYS)],
});
