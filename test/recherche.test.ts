import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';
import { RECHERCHE_DEFAULT_CONSIGNES } from '#/modules/recherche/consignes.ts';

import { createFakeAiSession } from './fake-ai-session.ts';
import { createRecordedFetch } from './recorded-http.ts';

const EXAMPLE_CONFIG_PATH = path.join(import.meta.dirname, '..', 'config.example.json');

// The Béthune Offre of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OFFRE_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RECHERCHE = `# Recherche : attaché de justice au tribunal pour enfants de Béthune

Le tribunal judiciaire de Béthune compte un tribunal pour enfants ([justice.fr](https://www.justice.fr/)).

## Sources

- [justice.fr](https://www.justice.fr/)
`;

async function detectOffres(aiSession: ReturnType<typeof createFakeAiSession>) {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'job-finder-'));
  copyFileSync(EXAMPLE_CONFIG_PATH, path.join(dataDirectory, 'config.json'));
  const actions = await createActions({ dataDirectory, aiSession, fetch: createRecordedFetch().fetch });
  await actions.detect();
  return {
    actions,
    dataDirectory,
    offreDirectory: path.join(dataDirectory, 'candidats/lea/offres', OFFRE_DIRECTORY_NAME),
  };
}

describe('recherche', () => {
  it('produces the Recherche of an Offre as its first Version, retained', async () => {
    const aiSession = createFakeAiSession({ fileByName: { 'recherche.md': RECHERCHE } });
    const { actions, offreDirectory } = await detectOffres(aiSession);

    const { job, version, filePath } = await actions.runModule({ module: 'recherche', reference: REFERENCE });

    expect(job).toMatchObject({ module: 'recherche', state: 'done', sessionId: 'fake-session-1' });
    expect(version).toMatchObject({ artefact: 'recherche', number: 1, state: 'ready', isRetenue: true });
    expect(filePath).toBe(path.join(offreDirectory, 'recherche/v1/recherche.md'));
    expect(readFileSync(filePath, 'utf8')).toBe(RECHERCHE);
  });

  it('creates a new Version at each launch without overwriting the previous ones, and retains the latest', async () => {
    const secondRecherche = RECHERCHE.replace('Recherche :', 'Recherche relancée :');
    const aiSession = createFakeAiSession(
      { fileByName: { 'recherche.md': RECHERCHE } },
      { fileByName: { 'recherche.md': secondRecherche } },
    );
    const { actions, offreDirectory } = await detectOffres(aiSession);

    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: REFERENCE });

    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    expect(versionList.map(({ number, isRetenue }) => ({ number, isRetenue }))).toEqual([
      { number: 1, isRetenue: false },
      { number: 2, isRetenue: true },
    ]);
    expect(readFileSync(path.join(offreDirectory, 'recherche/v1/recherche.md'), 'utf8')).toBe(RECHERCHE);
    expect(readFileSync(path.join(offreDirectory, 'recherche/v2/recherche.md'), 'utf8')).toBe(secondRecherche);
  });

  it('retains the Version the Candidat chooses', async () => {
    const recherche = { fileByName: { 'recherche.md': RECHERCHE } };
    const { actions } = await detectOffres(createFakeAiSession(recherche, recherche));
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: REFERENCE });

    await actions.retenirVersion({ reference: REFERENCE, artefact: 'recherche', number: '1' });

    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    expect(versionList.map(({ number, isRetenue }) => ({ number, isRetenue }))).toEqual([
      { number: 1, isRetenue: true },
      { number: 2, isRetenue: false },
    ]);
  });

  it('sends the fixed part of the prompt and the default Consignes, and keeps them in the Version', async () => {
    const aiSession = createFakeAiSession({ fileByName: { 'recherche.md': RECHERCHE } });
    const { actions, offreDirectory } = await detectOffres(aiSession);

    const { version } = await actions.runModule({ module: 'recherche', reference: REFERENCE });

    expect(aiSession.headlessSessionList).toHaveLength(1);
    expect(aiSession.headlessSessionList[0]).toMatchObject({
      consignes: RECHERCHE_DEFAULT_CONSIGNES,
      directory: offreDirectory,
      outputDirectory: path.join(offreDirectory, 'recherche/v1'),
    });
    expect(aiSession.headlessSessionList[0]?.fixedPrompt).toContain("N'invente jamais un fait.");
    expect(aiSession.headlessSessionList[0]?.fixedPrompt).toContain('`recherche/v1/recherche.md`');
    expect(version).toMatchObject({ consignes: RECHERCHE_DEFAULT_CONSIGNES, inputList: [] });
  });

  it("replaces the default Consignes with the Candidat's own, keeping the fixed part", async () => {
    const consignes = 'Insiste sur la justice des mineurs dans le ressort de Béthune.\n';
    const aiSession = createFakeAiSession({ fileByName: { 'recherche.md': RECHERCHE } });
    const { actions, dataDirectory } = await detectOffres(aiSession);
    mkdirSync(path.join(dataDirectory, 'candidats/lea/consignes'));
    writeFileSync(path.join(dataDirectory, 'candidats/lea/consignes/recherche.md'), consignes);

    const { version } = await actions.runModule({ module: 'recherche', reference: REFERENCE });

    expect(aiSession.headlessSessionList[0]?.consignes).toBe(consignes);
    expect(aiSession.headlessSessionList[0]?.fixedPrompt).toContain("N'invente jamais un fait.");
    expect(version.consignes).toBe(consignes);
  });
});

describe('a launch refused', () => {
  it('refuses an unknown Offre without launching Claude', async () => {
    const aiSession = createFakeAiSession();
    const { actions } = await detectOffres(aiSession);

    await expect(actions.runModule({ module: 'recherche', reference: '2026-0000000' })).rejects.toThrow(
      /Offre inconnue : 2026-0000000/,
    );
    expect(aiSession.headlessSessionList).toEqual([]);
  });

  it.each(['fiche_entretien', 'inconnu'])(
    'refuses the module « %s », not available, without launching Claude',
    async (module) => {
      const aiSession = createFakeAiSession();
      const { actions } = await detectOffres(aiSession);

      await expect(actions.runModule({ module, reference: REFERENCE })).rejects.toThrow(
        new RegExp(String.raw`Module inconnu : ${module}\. Modules : recherche, lettre\.`),
      );
      expect(aiSession.headlessSessionList).toEqual([]);
    },
  );
});

describe('a Recherche that fails', () => {
  it.each([
    { problem: 'the expected file is absent', plannedRun: {}, log: /recherche\/v1\/recherche\.md est absent/ },
    {
      problem: 'the expected file is empty',
      plannedRun: { fileByName: { 'recherche.md': ' \n' } },
      log: /recherche\/v1\/recherche\.md est vide/,
    },
    {
      problem: 'the expected file has no sources',
      plannedRun: { fileByName: { 'recherche.md': '# Recherche\n\nAucune source.\n' } },
      log: /recherche\/v1\/recherche\.md est mal formé/,
    },
    {
      problem: 'the Claude session fails',
      plannedRun: { fileByName: { 'recherche.md': RECHERCHE }, isSuccess: false },
      log: /Claude Code a rencontré une erreur/,
    },
  ])('puts the Version and the job « en échec » when $problem', async ({ plannedRun, log }) => {
    const { actions } = await detectOffres(createFakeAiSession(plannedRun));

    const { job, version } = await actions.runModule({ module: 'recherche', reference: REFERENCE });

    expect(job.state).toBe('failed');
    expect(job.log).toMatch(log);
    expect(version).toMatchObject({ number: 1, state: 'failed', isRetenue: false });
  });

  it('keeps the Version retenue when a new launch fails, and can be launched again', async () => {
    const recherche = { fileByName: { 'recherche.md': RECHERCHE } };
    const { actions } = await detectOffres(createFakeAiSession(recherche, {}, recherche));

    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    await actions.runModule({ module: 'recherche', reference: REFERENCE });
    const afterFailureVersionList = await actions.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    await actions.runModule({ module: 'recherche', reference: REFERENCE });

    expect(afterFailureVersionList.map(({ number, state, isRetenue }) => ({ number, state, isRetenue }))).toEqual([
      { number: 1, state: 'ready', isRetenue: true },
      { number: 2, state: 'failed', isRetenue: false },
    ]);
    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'recherche' });
    expect(versionList.map(({ number, state, isRetenue }) => ({ number, state, isRetenue }))).toEqual([
      { number: 1, state: 'ready', isRetenue: false },
      { number: 2, state: 'failed', isRetenue: false },
      { number: 3, state: 'ready', isRetenue: true },
    ]);
  });

  // A Postulée Offre keeps the Lettre that was sent (spec « Versions »)
  it('refuses to change the Lettre retenue of a Postulée Offre', async () => {
    const { actions } = await detectOffres(createFakeAiSession());
    await actions.changeStatus({ reference: REFERENCE, status: 'postulee' });

    await expect(actions.retenirVersion({ reference: REFERENCE, artefact: 'lettre', number: 1 })).rejects.toThrow(
      /L'Offre 2026-2445600 est Postulée : sa Lettre retenue est figée/,
    );
  });

  it('refuses to retain a Version « en échec »', async () => {
    const { actions } = await detectOffres(createFakeAiSession({}));
    await actions.runModule({ module: 'recherche', reference: REFERENCE });

    await expect(actions.retenirVersion({ reference: REFERENCE, artefact: 'recherche', number: 1 })).rejects.toThrow(
      /recherche v1 de l'Offre 2026-2445600 est en échec/,
    );
  });
});
