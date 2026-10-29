import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createFakeNotificationChannel } from './fake-notification-channel.ts';
import { createRecordedFetch } from './recorded-http.ts';

const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', 'config.example.json');

// A Fiche de poste found elsewhere than on the Sources the Veilles read
const FICHE_DE_POSTE = `# Greffier placé – Tribunal judiciaire de Lille

**Employeur :** Ministère de la Justice – Tribunal judiciaire de Lille

**Lieu d'affectation :** 13 avenue du Peuple Belge, 59000 Lille

## Missions

Le greffier assiste les magistrats du siège et du parquet.

## Candidature

Date limite de candidature : 30/11/2026.

Adresser CV et lettre de motivation à greffe.tj-lille@justice.fr

Contact : Marie Martin, directrice de greffe, 03 20 00 00 00
`;

// What the extraction session writes for it, each field copied from the Fiche de poste
const EXTRACTION = {
  title: 'Greffier placé – Tribunal judiciaire de Lille',
  employer: 'Ministère de la Justice – Tribunal judiciaire de Lille',
  workplace: '13 avenue du Peuple Belge, 59000 Lille',
  city: 'Lille',
  dateLimite: '2026-11-30',
  applicationEmail: 'greffe.tj-lille@justice.fr',
  contact1: 'Marie Martin, directrice de greffe, 03 20 00 00 00',
  contact2: null,
};

const RECHERCHE = `# Recherche : greffier placé à Lille

Le tribunal judiciaire de Lille est l'un des plus grands de France ([justice.fr](https://www.justice.fr/)).

## Sources

- [justice.fr](https://www.justice.fr/)
`;

function extractionRun(extraction: Record<string, unknown> = EXTRACTION) {
  return { fileByName: { 'extraction.json': JSON.stringify(extraction) } };
}

async function openActions(aiSession: ReturnType<typeof createFakeAiSession>) {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  return createActions({
    dataDirectory,
    aiSession,
    fetch: createRecordedFetch().fetch,
    notificationChannel: createFakeNotificationChannel(),
  });
}

describe('import of a Fiche de poste in Markdown', () => {
  it('creates an Offre of the Candidat with the fields the session extracted and the Fiche de poste as imported', async () => {
    const actions = await openActions(createFakeAiSession(extractionRun()));

    const offre = await actions.importFicheDePoste({ candidatId: 'lea', markdown: FICHE_DE_POSTE });

    expect(offre).toMatchObject({
      candidatId: 'lea',
      title: 'Greffier placé – Tribunal judiciaire de Lille',
      employer: 'Ministère de la Justice – Tribunal judiciaire de Lille',
      workplace: '13 avenue du Peuple Belge, 59000 Lille',
      dateLimite: new Date('2026-11-30T00:00:00Z'),
      applicationEmail: 'greffe.tj-lille@justice.fr',
      contact1: 'Marie Martin, directrice de greffe, 03 20 00 00 00',
      contact2: null,
      url: null,
      publishedAt: null,
      status: 'a_traiter',
    });
    expect(await actions.listOffres({ candidatId: 'lea' })).toEqual([offre]);
    const { ficheDePoste } = await actions.readOffre({ reference: offre.reference });
    expect(ficheDePoste).toBe(FICHE_DE_POSTE);
  });

  it('locates the imported Offre in its ville with API Géo, to show it on the map', async () => {
    const actions = await openActions(createFakeAiSession(extractionRun()));

    const offre = await actions.importFicheDePoste({ candidatId: 'lea', markdown: FICHE_DE_POSTE });

    // API Géo's answer recorded on 2026-10-29 for Lille
    expect(offre).toMatchObject({ city: 'Lille', region: 'Hauts-de-France', latitude: 50.6311, longitude: 3.0468 });
  });

  it('leaves empty each field the session did not find in the Fiche de poste', async () => {
    const markdown = '# Greffier placé – Tribunal judiciaire de Lille\n\nLe greffier assiste les magistrats.\n';
    const extraction = Object.fromEntries(Object.keys(EXTRACTION).map((field) => [field, null]));
    const actions = await openActions(
      createFakeAiSession(extractionRun({ ...extraction, title: 'Greffier placé – Tribunal judiciaire de Lille' })),
    );

    const offre = await actions.importFicheDePoste({ candidatId: 'lea', markdown });

    expect(offre).toMatchObject({
      title: 'Greffier placé – Tribunal judiciaire de Lille',
      employer: null,
      workplace: null,
      city: null,
      dateLimite: null,
      applicationEmail: null,
      contact1: null,
      contact2: null,
      isExpiree: false,
    });
  });

  it('queues the Recherche of the imported Offre, which the worker then runs', async () => {
    const aiSession = createFakeAiSession(extractionRun(), { fileByName: { 'recherche.md': RECHERCHE } });
    const actions = await openActions(aiSession);

    const { reference } = await actions.importFicheDePoste({ candidatId: 'lea', markdown: FICHE_DE_POSTE });

    const { artefactList } = await actions.readOffre({ reference });
    expect(artefactList.find(({ artefact }) => artefact === 'recherche')?.etat).toBe('en_cours');
    const jobList = await actions.runQueuedJobs();
    expect(jobList.map(({ module, state, offre }) => ({ module, state, reference: offre.reference }))).toEqual([
      { module: 'recherche', state: 'done', reference },
    ]);
  });

  it('imports the same Fiche de poste once: importing it again gives back its Offre', async () => {
    const aiSession = createFakeAiSession(extractionRun(), extractionRun());
    const actions = await openActions(aiSession);
    const offre = await actions.importFicheDePoste({ candidatId: 'lea', markdown: FICHE_DE_POSTE });

    expect(await actions.importFicheDePoste({ candidatId: 'lea', markdown: FICHE_DE_POSTE })).toEqual(offre);

    expect(await actions.listOffres({ candidatId: 'lea' })).toEqual([offre]);
    expect(aiSession.headlessSessionList).toHaveLength(1);
    expect(await actions.runQueuedJobs()).toHaveLength(1);
  });

  it('fails visibly when the session fails, saving nothing, so that the import can be run again', async () => {
    const actions = await openActions(createFakeAiSession({ isSuccess: false }, extractionRun()));

    await expect(actions.importFicheDePoste({ candidatId: 'lea', markdown: FICHE_DE_POSTE })).rejects.toThrow(
      "L'extraction des champs de la Fiche de poste a échoué : Claude Code a rencontré une erreur. Relancer l'import.",
    );
    expect(await actions.listOffres({ candidatId: 'lea' })).toEqual([]);

    const offre = await actions.importFicheDePoste({ candidatId: 'lea', markdown: FICHE_DE_POSTE });
    expect(await actions.listOffres({ candidatId: 'lea' })).toEqual([offre]);
  });

  it('refuses a field the Fiche de poste does not contain as is, which the session invented', async () => {
    const actions = await openActions(
      createFakeAiSession(
        extractionRun({ ...EXTRACTION, city: 'Douai', applicationEmail: 'recrutement.tj-lille@justice.fr' }),
      ),
    );

    await expect(actions.importFicheDePoste({ candidatId: 'lea', markdown: FICHE_DE_POSTE })).rejects.toThrow(
      /figure pas tel quel dans la Fiche de poste[\s\S]*city[\s\S]*figure pas tel quel[\s\S]*applicationEmail/,
    );
    expect(await actions.listOffres({ candidatId: 'lea' })).toEqual([]);
  });

  it('refuses an unknown Candidat before any session', async () => {
    const aiSession = createFakeAiSession(extractionRun());
    const actions = await openActions(aiSession);

    await expect(actions.importFicheDePoste({ candidatId: 'camille', markdown: FICHE_DE_POSTE })).rejects.toThrow(
      'Candidat inconnu : camille.',
    );
    expect(aiSession.headlessSessionList).toEqual([]);
  });

  it('refuses a Fiche de poste without the title of its Poste, rather than inventing one', async () => {
    const actions = await openActions(createFakeAiSession(extractionRun({ ...EXTRACTION, title: null })));

    await expect(actions.importFicheDePoste({ candidatId: 'lea', markdown: FICHE_DE_POSTE })).rejects.toThrow(
      "La Fiche de poste ne donne pas l'intitulé du poste, sans lequel l'Offre ne peut se suivre. L'ajouter en tête du fichier (« # Intitulé du poste »), puis relancer l'import.",
    );
    expect(await actions.listOffres({ candidatId: 'lea' })).toEqual([]);
  });

  it('takes a field copied with other case, spacing or apostrophes as found in the Fiche de poste', async () => {
    const markdown = '# Attaché d’administration\n\nAffectation : 59000 LILLE\n';
    const extraction = Object.fromEntries(Object.keys(EXTRACTION).map((field) => [field, null]));
    const actions = await openActions(
      createFakeAiSession(
        extractionRun({ ...extraction, title: "Attaché d'administration", workplace: '59000  Lille', city: 'Lille' }),
      ),
    );

    const offre = await actions.importFicheDePoste({ candidatId: 'lea', markdown });

    expect(offre).toMatchObject({ title: "Attaché d'administration", workplace: '59000  Lille', city: 'Lille' });
  });

  it.each([
    { failure: 'writes no extraction', plannedRun: {} },
    {
      failure: 'writes an extraction that is not JSON',
      plannedRun: { fileByName: { 'extraction.json': 'Titre : Greffier placé' } },
    },
    {
      failure: 'writes an extraction of another shape',
      plannedRun: extractionRun({ ...EXTRACTION, dateLimite: '30/11/2026' }),
    },
  ])('fails visibly when the session $failure, saving nothing', async ({ plannedRun }) => {
    const actions = await openActions(createFakeAiSession(plannedRun));

    await expect(actions.importFicheDePoste({ candidatId: 'lea', markdown: FICHE_DE_POSTE })).rejects.toThrow(
      /^Les champs relevés dans la Fiche de poste ne sont pas valables \(extraction\.json\) : .+ Relancer l'import\.$/s,
    );
    expect(await actions.listOffres({ candidatId: 'lea' })).toEqual([]);
  });
});
