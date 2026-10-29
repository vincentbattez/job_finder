import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createActions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch } from './recorded-http.ts';

// Fills the data folder of the front's e2e tests, which playwright.config.ts names in
// JF_DATA_DIRECTORY, through the actions and with the fakes of the external boundaries: the HTTP of
// the PEP Source recorded on 2026-10-29, the fake launch of Claude and the fake notification
// channel. Léa follows the attaché de justice Offres, and the Béthune Offre 2026-2445600 has two
// Recherches, the first one retenue, and a Lettre; the Melun Offres, past their Date limite, are
// Postulée, Archivée and À traiter; Camille has no Veille, hence no Offre. The tests
// that change data work on Offres of their own: Bastia 2026-2426147 (a Recherche and a Lettre to
// correct), Versailles 2026-2409178 (two Recherches), Rennes 2026-2420931 (a Recherche, ready for
// its Lettre) and Narbonne 2026-2412591 (a Recherche en échec).
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
const NOTIFICATION = { channel: 'home-assistant', service: 'notify.mobile_app_test' };
const CONFIG = {
  defaultDelayMonths: 6,
  candidatList: [
    {
      id: 'lea',
      name: 'Léa',
      notification: NOTIFICATION,
      veilleList: [
        {
          id: 'attache-de-justice-hauts-de-france',
          source: 'pep',
          criteria: { title: 'attaché de justice' },
          zone: { courtOfAppealList: ['Douai', 'Amiens'] },
        },
      ],
    },
    { id: 'camille', name: 'Camille', notification: NOTIFICATION, veilleList: [] },
  ],
};

// What the Lettre recommends for the Béthune Offre, from its mail de candidature and contacts
const RECIPIENTS = {
  to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
  ccList: [{ email: 'sec.p.tj-bethune@justice.fr', source: 'contact2' }],
  salutation: { text: 'Madame la Présidente,', source: 'contact1' },
  justification: 'Le mail de candidature est celui de la présidence ; le contact 2 demande le secrétariat en copie.',
};

function recherche(title: string): string {
  return `# ${title} : le tribunal pour enfants de Béthune\n\n## Sources\n\n- https://www.justice.fr/\n`;
}

// Bastia publishes no address the Lettre could recommend as is: it falls back on a generic salutation
const BASTIA_LETTRE = {
  fileByName: {
    'brouillon.md': 'Madame la Première présidente,\n\nTitulaire d’un [à compléter : diplôme et année d’obtention].\n',
    'destinataires.json': JSON.stringify({
      to: null,
      ccList: [],
      salutation: { text: 'Madame, Monsieur,', source: null },
      justification: 'Aucun champ de l’Offre ne donne une adresse telle quelle.',
    }),
  },
};

function rechercheRun(title: string) {
  return { fileByName: { 'recherche.md': `# ${title}\n\n## Sources\n\n- https://www.justice.fr/\n` } };
}

rmSync(dataDirectory, { recursive: true, force: true });
mkdirSync(dataDirectory, { recursive: true });
writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify(CONFIG));
const actions = await createActions({
  dataDirectory,
  fetch: createRecordedFetch().fetch,
  notificationChannel: createFakeNotificationChannel(),
  aiSession: createFakeAiSession(
    { fileByName: { 'recherche.md': recherche('Recherche retenue') } },
    { fileByName: { 'recherche.md': recherche('Recherche relancée') } },
    { fileByName: { 'brouillon.md': 'Madame la Présidente,\n', 'destinataires.json': JSON.stringify(RECIPIENTS) } },
    rechercheRun('Recherche : la cour d’appel de Bastia'),
    rechercheRun('Recherche première : le pôle civil du TJ de Versailles'),
    rechercheRun('Recherche relancée : le pôle civil du TJ de Versailles'),
    BASTIA_LETTRE,
    rechercheRun('Recherche : la JIRS du TJ de Rennes'),
    { isSuccess: false },
  ),
});
await actions.detect();
await actions.runModule({ module: 'recherche', reference: BETHUNE_REFERENCE });
await actions.runModule({ module: 'recherche', reference: BETHUNE_REFERENCE });
// The worker's turn, which the e2e tests take here rather than in a worker process
await actions.runQueuedJobs();
await actions.retenirVersion({ reference: BETHUNE_REFERENCE, artefact: 'recherche', number: 1 });
await actions.runModule({ module: 'lettre', reference: BETHUNE_REFERENCE });
await actions.runQueuedJobs();
await actions.runModule({ module: 'recherche', reference: BASTIA_REFERENCE });
await actions.runModule({ module: 'recherche', reference: VERSAILLES_REFERENCE });
await actions.runModule({ module: 'recherche', reference: VERSAILLES_REFERENCE });
await actions.runQueuedJobs();
await actions.runModule({ module: 'lettre', reference: BASTIA_REFERENCE });
await actions.runQueuedJobs();
await actions.runModule({ module: 'recherche', reference: RENNES_REFERENCE });
await actions.runModule({ module: 'recherche', reference: NARBONNE_REFERENCE });
await actions.runQueuedJobs();
await actions.changeStatus({ reference: '2026-2285305', status: 'postulee' });
await actions.changeStatus({ reference: '2026-2290529', status: 'archivee' });
