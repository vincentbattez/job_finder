import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createActions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createRecordedFetch } from './recorded-http.ts';

// Fills the data folder of the front's e2e tests, which playwright.config.ts names in
// JF_DATA_DIRECTORY, through the actions and with the fakes of the external boundaries: the HTTP of
// the PEP Source recorded on 2026-10-29 and the fake launch of Claude. Léa follows the attaché de
// justice Offres, and the Béthune Offre 2026-2445600 has two Recherches, the first one retenue, and
// a Lettre; Camille has no Veille, hence no Offre. Sacha, without Veille either, has a Profil and
// is the one whose Profil and Consignes the e2e tests change. Léa's Offre 2026-2409247 has a
// Recherche made with the default Consignes, then one made with hers.
const dataDirectory = process.env.JF_DATA_DIRECTORY ?? '';
// The folder is wiped first: anything outside the temporary folder, data/ above all, is refused
if (!dataDirectory.startsWith(tmpdir())) {
  throw new Error(`JF_DATA_DIRECTORY doit être un dossier temporaire, pas « ${dataDirectory} ».`);
}
const BETHUNE_REFERENCE = '2026-2445600';
const CONSIGNES_REFERENCE = '2026-2409247';
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
    { id: 'sacha', name: 'Sacha', notification: NOTIFICATION, veilleList: [] },
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

rmSync(dataDirectory, { recursive: true, force: true });
mkdirSync(dataDirectory, { recursive: true });
writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify(CONFIG));
const actions = await createActions({
  dataDirectory,
  fetch: createRecordedFetch().fetch,
  aiSession: createFakeAiSession(
    { fileByName: { 'recherche.md': recherche('Recherche retenue') } },
    { fileByName: { 'recherche.md': recherche('Recherche relancée') } },
    { fileByName: { 'brouillon.md': 'Madame la Présidente,\n', 'destinataires.json': JSON.stringify(RECIPIENTS) } },
    { fileByName: { 'recherche.md': recherche('Recherche par défaut') } },
    { fileByName: { 'recherche.md': recherche('Recherche selon Léa') } },
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

// What jf profil would have written in Sacha's Profil
const sachaProfilDirectory = path.join(dataDirectory, 'candidats/sacha/profil');
writeFileSync(path.join(sachaProfilDirectory, 'cv.md'), '# CV de Sacha\n\n## Formation\n\n- Master 2 droit public\n');
writeFileSync(path.join(sachaProfilDirectory, 'faits.md'), '# Faits\n\n## Mobilité\n\n- Lille et alentours\n');

// One Recherche with the default Consignes, one with Léa's, which she then deletes
await actions.runModule({ module: 'recherche', reference: CONSIGNES_REFERENCE });
await actions.runQueuedJobs();
await actions.saveConsignes({ candidatId: 'lea', module: 'recherche', consignes: 'Creuse la ville.\n' });
await actions.runModule({ module: 'recherche', reference: CONSIGNES_REFERENCE });
await actions.runQueuedJobs();
await actions.deleteConsignes({ candidatId: 'lea', module: 'recherche' });
