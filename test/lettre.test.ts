import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { LETTRE_DEFAULT_CONSIGNES } from '#/modules/lettre/consignes.ts';

import { detectOffres as detectRecordedOffres, LEA_OFFRES_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// Béthune, tribunal pour enfants: mail p.tj-bethune@justice.fr, contact 1 the présidente, contact 2
// « secrétariat en copie : sec.p.tj-bethune@justice.fr » (responses recorded on 2026-10-29)
const REFERENCE = '2026-2445600';
const OFFRE_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RECHERCHE_RUN = {
  fileByName: {
    'recherche.md':
      '# Recherche\n\nLe TJ de Béthune ([justice.fr](https://www.justice.fr/)).\n\n## Sources\n\n- https://www.justice.fr/\n',
  },
};

const BROUILLON = `Madame la Présidente,

Titulaire d'un [à compléter : diplôme et année d'obtention], je souhaite rejoindre le tribunal pour enfants de Béthune.
`;

const RECIPIENTS = {
  to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
  ccList: [{ email: 'sec.p.tj-bethune@justice.fr', source: 'contact2' }],
  salutation: { text: 'Madame la Présidente,', source: 'contact1' },
  justification: 'Le mail de candidature est celui de la présidence ; le contact 2 demande le secrétariat en copie.',
};

function lettreRun(recipients: object = RECIPIENTS) {
  return { fileByName: { 'brouillon.md': BROUILLON, 'destinataires.json': JSON.stringify(recipients, undefined, 2) } };
}

// Avesnes-sur-Helpe publishes its mail de candidature as free text, an address within a sentence
const AVESNES_REFERENCE = '2026-2199164';
const AVESNES_APPLICATION_EMAIL = 'Laurent DUMAINE, Procureur de la République : pr.tj-avesnes-sur-helpe@justice.fr';
const AVESNES_RECIPIENTS = {
  to: { email: 'pr.tj-avesnes-sur-helpe@justice.fr', source: 'applicationEmail' },
  ccList: [{ email: 'sec.pr.tj-avesnes-sur-helpe@justice.fr', source: 'contact1' }],
  salutation: { text: 'Monsieur le Procureur de la République,', source: 'applicationEmail' },
  justification: "Le mail de candidature nomme le procureur et donne l'adresse de son parquet.",
};

// Two other Offres of Léa: the second Béthune siège Offre and the Béthune parquet one
const SENT_REFERENCE = '2026-2445609';
const SENT_DIRECTORY_NAME =
  '2026-2445609-attache-de-justice-affecte-aupres-des-magistrats-du-siege-service-de-l-instruction-tj-bethune';
const UNSENT_REFERENCE = '2026-2445183';
const UNSENT_RECIPIENTS = {
  to: { email: 'chcab.pr.tj-bethune@justice.fr', source: 'applicationEmail' },
  ccList: [],
  salutation: { text: 'Monsieur le Procureur de la République,', source: null },
  justification: 'Le mail de candidature est celui du cabinet du procureur.',
};

async function detectOffres(aiSession: ReturnType<typeof createFakeAiSession>) {
  const { actions, dataDirectory } = await detectRecordedOffres(aiSession);
  return { actions, dataDirectory, offreDirectory: path.join(dataDirectory, LEA_OFFRES_PATH, OFFRE_DIRECTORY_NAME) };
}

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runModule(actions: Actions, module: string, reference: string) {
  const { id } = await actions.runModule({ module, reference });
  await actions.runQueuedJobs();
  return actions.followJob({ jobId: id });
}

describe('lettre', () => {
  it('produces a Version holding the Brouillon, the Lettre as its copy, and the recommended recipients', async () => {
    const { actions, offreDirectory } = await detectOffres(createFakeAiSession(RECHERCHE_RUN, lettreRun()));
    await runModule(actions, 'recherche', REFERENCE);

    const job = await runModule(actions, 'lettre', REFERENCE);

    expect(job).toMatchObject({ module: 'lettre', state: 'done' });
    expect(job.version).toMatchObject({ artefact: 'lettre', number: 1, state: 'ready', isRetenue: true });
    expect(readFileSync(path.join(offreDirectory, 'lettre/v1/lettre.md'), 'utf8')).toBe(BROUILLON);
    expect(readFileSync(path.join(offreDirectory, 'lettre/v1/brouillon.md'), 'utf8')).toBe(BROUILLON);
    expect(await actions.readRecipients({ reference: REFERENCE })).toEqual(RECIPIENTS);
  });

  it('creates a new pair at each launch, and makes each Brouillon read-only', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, lettreRun(), lettreRun());
    const { actions, offreDirectory } = await detectOffres(aiSession);
    await runModule(actions, 'recherche', REFERENCE);

    await runModule(actions, 'lettre', REFERENCE);
    await runModule(actions, 'lettre', REFERENCE);

    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'lettre' });
    expect(versionList.map(({ number, isRetenue }) => ({ number, isRetenue }))).toEqual([
      { number: 1, isRetenue: false },
      { number: 2, isRetenue: true },
    ]);
    for (const version of ['v1', 'v2']) {
      const brouillonPath = path.join(offreDirectory, 'lettre', version, 'brouillon.md');
      expect(statSync(brouillonPath).mode & 0o222).toBe(0);
      expect(statSync(path.join(offreDirectory, 'lettre', version, 'lettre.md')).mode & 0o200).toBe(0o200);
    }
  });

  it('reads the Fiche de poste, the Recherche retenue, the Profil and the pairs of the Offres already Postulées', async () => {
    const aiSession = createFakeAiSession(
      RECHERCHE_RUN,
      lettreRun(),
      RECHERCHE_RUN,
      lettreRun(UNSENT_RECIPIENTS),
      RECHERCHE_RUN,
      RECHERCHE_RUN,
      lettreRun(),
    );
    const { actions, dataDirectory, offreDirectory } = await detectOffres(aiSession);
    await runModule(actions, 'recherche', SENT_REFERENCE);
    await runModule(actions, 'lettre', SENT_REFERENCE);
    await actions.changeStatus({ reference: SENT_REFERENCE, status: 'postulee' });
    await runModule(actions, 'recherche', UNSENT_REFERENCE);
    await runModule(actions, 'lettre', UNSENT_REFERENCE);
    await runModule(actions, 'recherche', REFERENCE);
    await runModule(actions, 'recherche', REFERENCE);
    await actions.retenirVersion({ reference: REFERENCE, artefact: 'recherche', number: 1 });

    const { version } = await runModule(actions, 'lettre', REFERENCE);

    const profilDirectory = path.join(dataDirectory, 'candidats/lea/profil');
    const sentDirectory = path.join(dataDirectory, 'candidats/lea/offres', SENT_DIRECTORY_NAME, 'lettre/v1');
    const session = aiSession.headlessSessionList.at(-1);
    expect(session?.readDirectoryList).toEqual([
      profilDirectory,
      path.join(offreDirectory, 'recherche/v1'),
      sentDirectory,
    ]);
    expect(session?.fixedPrompt).toContain('`fiche-de-poste.md`');
    expect(session?.fixedPrompt).toContain(`\`${path.join(offreDirectory, 'recherche/v1/recherche.md')}\``);
    expect(session?.fixedPrompt).toContain(`\`${profilDirectory}\``);
    expect(session?.fixedPrompt).toContain(`\`${sentDirectory}\``);
    expect(session?.fixedPrompt).not.toContain(UNSENT_REFERENCE);
    expect(version?.inputList).toHaveLength(2);
    expect(version?.inputList).toEqual(
      expect.arrayContaining([
        { artefact: 'recherche', number: 1, offre: { reference: REFERENCE } },
        { artefact: 'lettre', number: 1, offre: { reference: SENT_REFERENCE } },
      ]),
    );
  });
});

describe('the prompt of the Lettre', () => {
  it('forbids inventing a fact on the Candidat and marks each missing one « [à compléter : …] »', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, lettreRun());
    const { actions } = await detectOffres(aiSession);
    await runModule(actions, 'recherche', REFERENCE);

    const { version } = await runModule(actions, 'lettre', REFERENCE);

    const { fixedPrompt, consignes } = aiSession.headlessSessionList[1] ?? {};
    expect(fixedPrompt).toContain("N'invente jamais un fait sur le Candidat");
    expect(fixedPrompt).toContain('`[à compléter : …]`');
    expect(consignes).toBe(LETTRE_DEFAULT_CONSIGNES);
    expect(version?.consignes).toBe(LETTRE_DEFAULT_CONSIGNES);
  });

  it("replaces the default Consignes with the Candidat's own, keeping the fixed part", async () => {
    const consignes = 'Une lettre courte, trois paragraphes au plus.\n';
    const aiSession = createFakeAiSession(RECHERCHE_RUN, lettreRun());
    const { actions, dataDirectory } = await detectOffres(aiSession);
    mkdirSync(path.join(dataDirectory, 'candidats/lea/consignes'));
    writeFileSync(path.join(dataDirectory, 'candidats/lea/consignes/lettre.md'), consignes);
    await runModule(actions, 'recherche', REFERENCE);

    const { version } = await runModule(actions, 'lettre', REFERENCE);

    expect(aiSession.headlessSessionList[1]?.consignes).toBe(consignes);
    expect(aiSession.headlessSessionList[1]?.fixedPrompt).toContain("N'invente jamais un fait sur le Candidat");
    expect(version?.consignes).toBe(consignes);
  });
});

describe('the recommended recipients', () => {
  it('reads a mail de candidature written as free text, as in Avesnes', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, lettreRun(AVESNES_RECIPIENTS));
    const { actions } = await detectOffres(aiSession);
    await runModule(actions, 'recherche', AVESNES_REFERENCE);

    const { version } = await runModule(actions, 'lettre', AVESNES_REFERENCE);

    expect(aiSession.headlessSessionList[1]?.fixedPrompt).toContain(`« ${AVESNES_APPLICATION_EMAIL} »`);
    expect(version?.state).toBe('ready');
    expect(await actions.readRecipients({ reference: AVESNES_REFERENCE })).toEqual(AVESNES_RECIPIENTS);
  });

  it.each([
    {
      problem: 'the free text is kept as the address',
      recipients: { ...AVESNES_RECIPIENTS, to: { email: AVESNES_APPLICATION_EMAIL, source: 'applicationEmail' } },
      log: /destinataires\.json est mal formé/,
    },
    {
      problem: 'an address is not in the field it cites',
      recipients: {
        ...AVESNES_RECIPIENTS,
        ccList: [{ email: 'sec.pr.tj-avesnes-sur-helpe@justice.fr', source: 'contact2' }],
      },
      log: /sec\.pr\.tj-avesnes-sur-helpe@justice\.fr ne figure pas dans le champ contact2 de l'Offre/,
    },
    {
      problem: 'an address is invented',
      recipients: { ...AVESNES_RECIPIENTS, to: { email: 'recrutement@justice.fr', source: 'applicationEmail' } },
      log: /recrutement@justice\.fr ne figure pas dans le champ applicationEmail de l'Offre/,
    },
  ])('puts the Version « en échec » when $problem', async ({ recipients, log: expectedLog }) => {
    const { actions } = await detectOffres(createFakeAiSession(RECHERCHE_RUN, lettreRun(recipients)));
    await runModule(actions, 'recherche', AVESNES_REFERENCE);

    const { log, version } = await runModule(actions, 'lettre', AVESNES_REFERENCE);

    expect(log).toMatch(expectedLog);
    expect(version).toMatchObject({ state: 'failed', isRetenue: false });
  });

  it('has none for an Offre without a Lettre retenue', async () => {
    const { actions } = await detectOffres(createFakeAiSession(RECHERCHE_RUN, {}));
    await runModule(actions, 'recherche', REFERENCE);
    await runModule(actions, 'lettre', REFERENCE);

    await expect(actions.readRecipients({ reference: REFERENCE })).rejects.toThrow(
      /L'Offre 2026-2445600 n'a pas de Lettre retenue/,
    );
  });
});

describe('a Lettre that fails', () => {
  it.each([
    { file: 'brouillon.md', plannedRun: { fileByName: { 'destinataires.json': JSON.stringify(RECIPIENTS) } } },
    { file: 'destinataires.json', plannedRun: { fileByName: { 'brouillon.md': BROUILLON } } },
  ])('puts the Version « en échec », without a Lettre, when $file is absent', async ({ file, plannedRun }) => {
    const { actions, offreDirectory } = await detectOffres(createFakeAiSession(RECHERCHE_RUN, plannedRun));
    await runModule(actions, 'recherche', REFERENCE);

    const { log, version } = await runModule(actions, 'lettre', REFERENCE);

    expect(log).toContain(`Le fichier attendu ${path.join('lettre/v1', file)} est absent.`);
    expect(version).toMatchObject({ state: 'failed', isRetenue: false });
    expect(existsSync(path.join(offreDirectory, 'lettre/v1/lettre.md'))).toBe(false);
  });

  it('puts the Version « en échec » when its recipients are not JSON', async () => {
    const plannedRun = {
      fileByName: { 'brouillon.md': BROUILLON, 'destinataires.json': 'à : p.tj-bethune@justice.fr' },
    };
    const { actions } = await detectOffres(createFakeAiSession(RECHERCHE_RUN, plannedRun));
    await runModule(actions, 'recherche', REFERENCE);

    const job = await runModule(actions, 'lettre', REFERENCE);

    expect(job).toMatchObject({ state: 'failed', log: /destinataires\.json est mal formé/ });
  });
});

describe('a Lettre refused', () => {
  it.each([
    { case: 'no Recherche', rechercheRunList: [] },
    { case: 'only a Recherche « en échec »', rechercheRunList: [{}] },
  ])('refuses to run without a Recherche retenue ($case), without launching Claude', async ({ rechercheRunList }) => {
    const aiSession = createFakeAiSession(...rechercheRunList);
    const { actions } = await detectOffres(aiSession);
    if (rechercheRunList.length > 0) {
      await runModule(actions, 'recherche', REFERENCE);
    }

    await expect(actions.runModule({ module: 'lettre', reference: REFERENCE })).rejects.toThrow(
      /L'Offre 2026-2445600 n'a pas de Recherche retenue.*jf run recherche 2026-2445600/,
    );
    expect(aiSession.headlessSessionList).toHaveLength(rechercheRunList.length);
    expect(await actions.listVersions({ reference: REFERENCE, artefact: 'lettre' })).toEqual([]);
  });

  // A Postulée Offre keeps the Lettre that was sent (spec « Versions »)
  it('refuses to produce a new Lettre for a Postulée Offre, without launching Claude', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, lettreRun(), lettreRun());
    const { actions } = await detectOffres(aiSession);
    await runModule(actions, 'recherche', REFERENCE);
    await runModule(actions, 'lettre', REFERENCE);
    await actions.changeStatus({ reference: REFERENCE, status: 'postulee' });

    await expect(actions.runModule({ module: 'lettre', reference: REFERENCE })).rejects.toThrow(
      /L'Offre 2026-2445600 a été Postulée : sa Lettre retenue est figée/,
    );
    expect(aiSession.headlessSessionList).toHaveLength(2);
    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'lettre' });
    expect(versionList.map(({ number, isRetenue }) => ({ number, isRetenue }))).toEqual([
      { number: 1, isRetenue: true },
    ]);
  });

  it('fails a Lettre queued before the Offre became Postulée, without launching Claude', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, lettreRun());
    const { actions } = await detectOffres(aiSession);
    await runModule(actions, 'recherche', REFERENCE);
    const { id } = await actions.runModule({ module: 'lettre', reference: REFERENCE });
    await actions.changeStatus({ reference: REFERENCE, status: 'postulee' });

    await actions.runQueuedJobs();

    expect(await actions.followJob({ jobId: id })).toMatchObject({
      state: 'failed',
      version: null,
      log: /L'Offre 2026-2445600 a été Postulée : sa Lettre retenue est figée/,
    });
    expect(aiSession.headlessSessionList).toHaveLength(1);
    expect(await actions.listVersions({ reference: REFERENCE, artefact: 'lettre' })).toEqual([]);
  });
});
