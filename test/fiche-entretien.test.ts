import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { FICHE_ENTRETIEN_DEFAULT_CONSIGNES } from '#/modules/fiche-entretien/consignes.ts';

import { detectOffres as detectRecordedOffres, LEA_OFFRES_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune Offre of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const OFFRE_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RECHERCHE_RUN = {
  fileByName: {
    'recherche.md':
      '# Recherche\n\nLe TJ de Béthune ([justice.fr](https://www.justice.fr/)).\n\n## Sources\n\n- https://www.justice.fr/\n',
  },
};

// A Lettre Version of the Béthune Offre, its recipients taken from the fields of the Offre
const LETTRE_RUN = {
  fileByName: {
    'brouillon.md': 'Madame la Présidente,\n\nJe souhaite rejoindre le tribunal pour enfants de Béthune.\n',
    'destinataires.json': JSON.stringify({
      to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
      ccList: [],
      salutation: { text: 'Madame la Présidente,', source: 'contact1' },
      justification: 'Le mail de candidature est celui de la présidence.',
    }),
  },
};

const FICHE_ENTRETIEN = `# Fiche d'entretien : tribunal pour enfants de Béthune

## À réviser

- L'assistance éducative et le code de la justice pénale des mineurs.

## Moyens mnémotechniques

- « PAS » : Protéger, Accompagner, Sanctionner.

## Présentez-vous

Titulaire d'un [à compléter : diplôme et année d'obtention], je souhaite rejoindre le tribunal pour enfants.

## Questions probables

- Pourquoi le tribunal pour enfants de Béthune ?
`;

function ficheRun(markdown = FICHE_ENTRETIEN) {
  return { fileByName: { 'fiche-entretien.md': markdown } };
}

async function detectOffres(aiSession: ReturnType<typeof createFakeAiSession>) {
  const { actions, dataDirectory } = await detectRecordedOffres(aiSession);
  return { actions, dataDirectory, offreDirectory: path.join(dataDirectory, LEA_OFFRES_PATH, OFFRE_DIRECTORY_NAME) };
}

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runModule(actions: Actions, module: string) {
  const { id } = await actions.runModule({ module, reference: REFERENCE });
  await actions.runQueuedJobs();
  return actions.followJob({ jobId: id });
}

describe("fiche d'entretien", () => {
  it('produces a new Version at each launch of jf run fiche, the latest one retenue', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, ficheRun(), ficheRun());
    const { actions, offreDirectory } = await detectOffres(aiSession);
    await runModule(actions, 'recherche');

    const job = await runModule(actions, 'fiche');
    await runModule(actions, 'fiche');

    expect(job).toMatchObject({ module: 'fiche_entretien', state: 'done' });
    expect(job.version).toMatchObject({ artefact: 'fiche_entretien', number: 1, state: 'ready' });
    expect(readFileSync(path.join(offreDirectory, 'fiche_entretien/v1/fiche-entretien.md'), 'utf8')).toBe(
      FICHE_ENTRETIEN,
    );
    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'fiche_entretien' });
    expect(versionList.map(({ number, isRetenue }) => ({ number, isRetenue }))).toEqual([
      { number: 1, isRetenue: false },
      { number: 2, isRetenue: true },
    ]);
  });

  it('refuses to run without a Recherche retenue, before queuing anything', async () => {
    const { actions } = await detectOffres(createFakeAiSession({ isSuccess: false }));
    await runModule(actions, 'recherche');

    const launch = actions.runModule({ module: 'fiche', reference: REFERENCE });

    await expect(launch).rejects.toThrow(
      "L'Offre 2026-2445600 n'a pas de Recherche retenue, sur laquelle s'appuie la Fiche d'entretien. La produire d'abord : jf run recherche 2026-2445600.",
    );
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  // The interview comes once the Lettre is sent: the Fiche d'entretien prepares the questions on it
  it('reads the Fiche de poste, the Recherche retenue, the Profil and the Lettre retenue, the one sent', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, RECHERCHE_RUN, LETTRE_RUN, ficheRun());
    const { actions, dataDirectory, offreDirectory } = await detectOffres(aiSession);
    await runModule(actions, 'recherche');
    await runModule(actions, 'recherche');
    await actions.retenirVersion({ reference: REFERENCE, artefact: 'recherche', number: 1 });
    await runModule(actions, 'lettre');
    await actions.changeStatus({ reference: REFERENCE, status: 'postulee' });

    const { version } = await runModule(actions, 'fiche');

    const profilDirectory = path.join(dataDirectory, 'candidats/lea/profil');
    const session = aiSession.headlessSessionList.at(-1);
    // The folder of the Offre is the session's own: only the folders outside it are added
    expect(session?.readDirectoryList).toEqual([profilDirectory]);
    expect(session?.fixedPrompt).toContain('`fiche-de-poste.md`');
    expect(session?.fixedPrompt).toContain(`\`${path.join(offreDirectory, 'recherche/v1/recherche.md')}\``);
    expect(session?.fixedPrompt).toContain(`\`${profilDirectory}\``);
    expect(session?.fixedPrompt).toContain(`\`${path.join(offreDirectory, 'lettre/v1/lettre.md')}\``);
    expect(version?.inputList).toEqual([
      { artefact: 'recherche', number: 1, offre: { reference: REFERENCE } },
      { artefact: 'lettre', number: 1, offre: { reference: REFERENCE } },
    ]);
  });

  it('runs without a Lettre, and tells the session there is none', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, ficheRun());
    const { actions, dataDirectory } = await detectOffres(aiSession);
    await runModule(actions, 'recherche');

    const { state, version } = await runModule(actions, 'fiche');

    expect(state).toBe('done');
    const session = aiSession.headlessSessionList.at(-1);
    expect(session?.readDirectoryList).toEqual([path.join(dataDirectory, 'candidats/lea/profil')]);
    expect(session?.fixedPrompt).toContain("Le Candidat n'a pas de Lettre pour cette Offre");
    expect(session?.fixedPrompt).not.toContain('lettre.md');
    expect(version?.inputList).toEqual([{ artefact: 'recherche', number: 1, offre: { reference: REFERENCE } }]);
  });
});

describe("the prompt of the Fiche d'entretien", () => {
  it('asks for a Fiche organised to revise and train, without inventing a fact on the Candidat', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, ficheRun());
    const { actions } = await detectOffres(aiSession);
    await runModule(actions, 'recherche');

    const { version } = await runModule(actions, 'fiche');

    const { fixedPrompt, consignes } = aiSession.headlessSessionList[1] ?? {};
    // The plan is the default Consignes': the Candidat's own may organise the Fiche otherwise
    for (const section of ['À réviser', 'Moyens mnémotechniques', 'Présentez-vous', 'Questions probables']) {
      expect(consignes).toContain(`## ${section}`);
      expect(fixedPrompt).not.toContain(`## ${section}`);
    }
    expect(fixedPrompt).toContain('titre de niveau 1');
    expect(fixedPrompt).toContain("N'invente jamais un fait sur le Candidat");
    expect(fixedPrompt).toContain('`[à compléter : …]`');
    expect(consignes).toBe(FICHE_ENTRETIEN_DEFAULT_CONSIGNES);
    expect(version?.consignes).toBe(FICHE_ENTRETIEN_DEFAULT_CONSIGNES);
  });

  it("replaces the default Consignes with the Candidat's own, keeping the fixed part", async () => {
    const consignes = 'Dix questions au plus, sans moyens mnémotechniques en images.\n';
    const aiSession = createFakeAiSession(RECHERCHE_RUN, ficheRun());
    const { actions, dataDirectory } = await detectOffres(aiSession);
    mkdirSync(path.join(dataDirectory, 'candidats/lea/consignes'));
    writeFileSync(path.join(dataDirectory, 'candidats/lea/consignes/fiche_entretien.md'), consignes);
    await runModule(actions, 'recherche');

    const { version } = await runModule(actions, 'fiche');

    expect(aiSession.headlessSessionList[1]?.consignes).toBe(consignes);
    expect(aiSession.headlessSessionList[1]?.fixedPrompt).toContain("N'invente jamais un fait sur le Candidat");
    expect(version?.consignes).toBe(consignes);
  });

  it('accepts a Fiche organised otherwise, as Consignes of the Candidat may ask', async () => {
    const tenQuestions = '# Fiche d’entretien\n\n## Dix questions\n\n- Pourquoi ce poste ?\n';
    const { actions } = await detectOffres(createFakeAiSession(RECHERCHE_RUN, ficheRun(tenQuestions)));
    await runModule(actions, 'recherche');

    const { state, version } = await runModule(actions, 'fiche');

    expect(state).toBe('done');
    expect(version?.state).toBe('ready');
  });

  it('fails the Version of a Fiche without a title', async () => {
    const withoutTitle = FICHE_ENTRETIEN.replace(/^# .*\n/, '');
    const { actions } = await detectOffres(createFakeAiSession(RECHERCHE_RUN, ficheRun(withoutTitle)));
    await runModule(actions, 'recherche');

    const { state, version, log } = await runModule(actions, 'fiche');

    expect(state).toBe('failed');
    expect(version?.state).toBe('failed');
    expect(log).toContain(
      'Le fichier fiche_entretien/v1/fiche-entretien.md est mal formé : il ne commence pas par un titre de niveau 1 (« # »).',
    );
  });
});

// A correction modifies the Version retenue in place (spec « Versions »)
describe("correcting the Fiche d'entretien", () => {
  it('saves the correction made in the front editor in the Version retenue', async () => {
    const { actions, offreDirectory } = await detectOffres(createFakeAiSession(RECHERCHE_RUN, ficheRun()));
    await runModule(actions, 'recherche');
    await runModule(actions, 'fiche');
    const corrected = FICHE_ENTRETIEN.replace(
      "[à compléter : diplôme et année d'obtention]",
      'master 2 de droit privé',
    );

    await actions.saveDocument({
      reference: REFERENCE,
      artefact: 'fiche_entretien',
      fileName: 'fiche-entretien.md',
      markdown: corrected,
    });

    const { artefactList } = await actions.readOffre({ reference: REFERENCE });
    const fiche = artefactList.find(({ artefact }) => artefact === 'fiche_entretien');
    expect(fiche?.versionList.map(({ documentList }) => documentList)).toEqual([
      [{ fileName: 'fiche-entretien.md', markdown: corrected, isModifiable: true }],
    ]);
    expect(readFileSync(path.join(offreDirectory, 'fiche_entretien/v1/fiche-entretien.md'), 'utf8')).toBe(corrected);
  });

  it('opens jf edit on the Version retenue', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, ficheRun(), ficheRun());
    const { actions, offreDirectory } = await detectOffres(aiSession);
    await runModule(actions, 'recherche');
    await runModule(actions, 'fiche');
    await runModule(actions, 'fiche');
    await actions.retenirVersion({ reference: REFERENCE, artefact: 'fiche_entretien', number: 1 });

    await actions.openArtefact({ reference: REFERENCE, artefact: 'fiche_entretien' });

    const [session] = aiSession.interactiveSessionList;
    expect(session?.directory).toBe(offreDirectory);
    expect(session?.prompt).toContain("Tu aides Léa à modifier la Fiche d'entretien de l'Offre 2026-2445600");
    expect(session?.prompt).toContain('`fiche_entretien/v1/`');
    expect(session?.prompt).not.toContain('fiche_entretien/v2');
  });
});
