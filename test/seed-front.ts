import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createActions } from '#/actions/index.ts';
import type { IHeadlessSession } from '#/ai-session/acl/claude-code.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { FAKE_HOME_ASSISTANT_TOKEN } from './fake-home-assistant.ts';
import { createLea } from './lea.ts';
import { createRecordedFetch } from './recorded-http.ts';

// Fills the data folder of the front's e2e tests, which playwright.config.ts names in
// JF_DATA_DIRECTORY, through the actions and with the fakes of the external boundaries: the HTTP of
// the PEP Source recorded on 2026-10-29, the fake launch of Claude and the fake Home Assistant that
// playwright.config.ts starts first. Léa follows the attaché de justice Postings, and the Béthune
// Posting 2026-2445600 has two Research, the first one chosen, and a Letter; the Melun Postings, past their Deadline, are
// Applied, Archived and To Apply; Camille has no Watch, hence no Posting. The tests
// that change data work on Postings of their own: Bastia 2026-2426147 (a Research and a Letter to
// correct), Versailles 2026-2409178 (two Research), Rennes 2026-2420931 (a Research, ready for
// its Letter) and Narbonne 2026-2412591 (a Research en échec). Sacha, Noé, Inès, Malo and Rose, without
// Watch either, each have their Profile changed by one e2e test only, which writes it first; Sacha
// also has the Instructions the e2e tests change. Léa, Camille and Sacha have their Notification Channel
// through the fake Home Assistant; Yanis and Zoé each have theirs changed by one e2e test only. Léa's Posting
// 2026-2409247 has a Research made with the default Instructions, then one made with hers. Jade, without
// Watch, has hers created, changed and deleted by one e2e test only.
const dataDirectory = process.env.JF_DATA_DIRECTORY ?? '';
// The folder is wiped first: anything outside the temporary folder, data/ above all, is refused
if (!dataDirectory.startsWith(tmpdir())) {
  throw new Error(`JF_DATA_DIRECTORY doit être un dossier temporaire, pas « ${dataDirectory} ».`);
}
const BETHUNE_REFERENCE = '2026-2445600';
const BASTIA_REFERENCE = '2026-2426147';
const VERSAILLES_REFERENCE = '2026-2409178';
const RENNES_REFERENCE = '2026-2420931';
const NARBONNE_REFERENCE = '2026-2412591';
const INSTRUCTIONS_REFERENCE = '2026-2409247';
// Where playwright.config.ts started the fake Home Assistant
const FAKE_HOME_ASSISTANT_URL = process.env.FAKE_HOME_ASSISTANT_URL ?? '';
// Without a Watch, beside Léa (test/lea.ts)
const OTHER_CANDIDATE_LIST = [
  { id: 'camille', name: 'Camille' },
  { id: 'sacha', name: 'Sacha' },
  { id: 'noe', name: 'Noé' },
  { id: 'ines', name: 'Inès' },
  { id: 'malo', name: 'Malo' },
  { id: 'yanis', name: 'Yanis' },
  { id: 'zoe', name: 'Zoé' },
  { id: 'rose', name: 'Rose' },
  { id: 'jade', name: 'Jade' },
];

// What the Letter recommends for the Béthune Posting, from its mail de candidature and contacts
const RECIPIENTS = {
  to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
  ccList: [{ email: 'sec.p.tj-bethune@justice.fr', source: 'contact2' }],
  salutation: { text: 'Madame la Présidente,', source: 'contact1' },
  justification: 'Le mail de candidature est celui de la présidence ; le contact 2 demande le secrétariat en copie.',
};

function research(title: string): string {
  return `# ${title} : le tribunal pour enfants de Béthune\n\n## Sources\n\n- https://www.justice.fr/\n`;
}

// Bastia publishes no address the Letter could recommend as is: it falls back on a generic salutation
const BASTIA_LETTER = {
  fileByName: {
    'draft.md': 'Madame la Première présidente,\n\nTitulaire d’un [à compléter : diplôme et année d’obtention].\n',
    'recipients.json': JSON.stringify({
      to: null,
      ccList: [],
      salutation: { text: 'Madame, Monsieur,', source: null },
      justification: 'Aucun champ de l’Offre ne donne une adresse telle quelle.',
    }),
  },
};

function researchRun(title: string) {
  return { fileByName: { 'research.md': `# ${title}\n\n## Sources\n\n- https://www.justice.fr/\n` } };
}

// What the fake Claude writes for each Version, by its Posting, Artifact and number, whatever the
// order the jobs run in
const RUN_BY_VERSION: Record<string, Parameters<typeof createFakeAiSession>[number]> = {
  [`${BETHUNE_REFERENCE} research v1`]: { fileByName: { 'research.md': research('Recherche retenue') } },
  [`${BETHUNE_REFERENCE} research v2`]: { fileByName: { 'research.md': research('Recherche relancée') } },
  [`${BETHUNE_REFERENCE} letter v1`]: {
    fileByName: { 'draft.md': 'Madame la Présidente,\n', 'recipients.json': JSON.stringify(RECIPIENTS) },
  },
  [`${BASTIA_REFERENCE} research v1`]: researchRun('Recherche : la cour d’appel de Bastia'),
  [`${BASTIA_REFERENCE} letter v1`]: BASTIA_LETTER,
  [`${VERSAILLES_REFERENCE} research v1`]: researchRun('Recherche première : le pôle civil du TJ de Versailles'),
  [`${VERSAILLES_REFERENCE} research v2`]: researchRun('Recherche relancée : le pôle civil du TJ de Versailles'),
  [`${RENNES_REFERENCE} research v1`]: researchRun('Recherche : la JIRS du TJ de Rennes'),
  [`${NARBONNE_REFERENCE} research v1`]: { isSuccess: false },
  [`${INSTRUCTIONS_REFERENCE} research v1`]: researchRun('Recherche par défaut : le TJ de Pontoise'),
  [`${INSTRUCTIONS_REFERENCE} research v2`]: researchRun('Recherche selon Léa : le TJ de Pontoise'),
};

// A session writes in <posting>/<artifact>/v<n>, the folder of its Posting starting with its reference
function versionOf({ outputDirectory }: IHeadlessSession): string {
  const artifactDirectory = path.dirname(outputDirectory);
  const reference = path.basename(path.dirname(artifactDirectory)).slice(0, BETHUNE_REFERENCE.length);
  return `${reference} ${path.basename(artifactDirectory)} ${path.basename(outputDirectory)}`;
}

rmSync(dataDirectory, { recursive: true, force: true });
mkdirSync(dataDirectory, { recursive: true });
const actions = await createActions({
  dataDirectory,
  fetch: createRecordedFetch().fetch,
  aiSession: {
    ...createFakeAiSession(),
    runHeadless: (session: IHeadlessSession) =>
      createFakeAiSession(RUN_BY_VERSION[versionOf(session)] ?? {}).runHeadless(session),
  },
});
// Created as from the front, which the database alone now knows (ADR-0011)
await createLea(actions);
for (const candidate of OTHER_CANDIDATE_LIST) {
  await actions.createCandidate(candidate);
}
// A notify service of the fake Home Assistant (test/fake-home-assistant.ts) for each phone
for (const [candidateId, service] of [
  ['lea', 'notify.mobile_app_iphone_de_lea'],
  ['camille', 'notify.mobile_app_pixel_de_camille'],
  ['sacha', 'notify.mobile_app_iphone_de_sacha'],
]) {
  await actions.saveNotificationChannel({
    candidateId,
    channel: 'home-assistant',
    parameters: { url: FAKE_HOME_ASSISTANT_URL, token: FAKE_HOME_ASSISTANT_TOKEN, service },
  });
}
await actions.detect();
await actions.runModule({ module: 'research', reference: BETHUNE_REFERENCE });
await actions.runModule({ module: 'research', reference: BETHUNE_REFERENCE });
// The worker's turn, which the e2e tests take here rather than in a worker process
await actions.runQueuedJobs();
await actions.chooseVersion({ reference: BETHUNE_REFERENCE, artifact: 'research', number: 1 });
await actions.runModule({ module: 'letter', reference: BETHUNE_REFERENCE });
await actions.runQueuedJobs();
await actions.runModule({ module: 'research', reference: BASTIA_REFERENCE });
await actions.runModule({ module: 'research', reference: VERSAILLES_REFERENCE });
await actions.runModule({ module: 'research', reference: VERSAILLES_REFERENCE });
await actions.runQueuedJobs();
await actions.runModule({ module: 'letter', reference: BASTIA_REFERENCE });
await actions.runQueuedJobs();
await actions.runModule({ module: 'research', reference: RENNES_REFERENCE });
await actions.runModule({ module: 'research', reference: NARBONNE_REFERENCE });
await actions.runQueuedJobs();

// One Research with the default Instructions, one with Léa's, which she then deletes
await actions.runModule({ module: 'research', reference: INSTRUCTIONS_REFERENCE });
await actions.runQueuedJobs();
await actions.saveInstructions({ candidateId: 'lea', module: 'research', instructions: 'Creuse la ville.\n' });
await actions.runModule({ module: 'research', reference: INSTRUCTIONS_REFERENCE });
await actions.runQueuedJobs();
await actions.deleteInstructions({ candidateId: 'lea', module: 'research' });

await actions.changeStatus({ reference: '2026-2285305', status: 'applied' });
await actions.changeStatus({ reference: '2026-2290529', status: 'archived' });
