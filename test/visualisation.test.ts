import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { VISUALISATION_DEFAULT_INSTRUCTIONS } from '#/modules/visualisation/instructions.ts';

import { detectPostings as detectRecordedPostings, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune Posting of the tribunal pour enfants, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const POSTING_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RECHERCHE_RUN = {
  fileByName: { 'recherche.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

const FICHE_RUN = {
  fileByName: {
    'fiche-entretien.md': [
      "# Fiche d'entretien : tribunal pour enfants de Béthune",
      "## À réviser\n\n- L'assistance éducative.",
      '## Moyens mnémotechniques\n\n- « PAS » : Protéger, Accompagner, Sanctionner.',
      '## Présentez-vous\n\nTitulaire d’un [à compléter : diplôme], je souhaite rejoindre le tribunal pour enfants.',
      '## Questions probables\n\n- Pourquoi le tribunal pour enfants de Béthune ?\n',
    ].join('\n\n'),
  },
};

// The same content as the Fiche, as a table and an inline diagram
const VISUALISATION = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Fiche d'entretien : tribunal pour enfants de Béthune</title>
<style>table { border-collapse: collapse; }</style></head>
<body>
<h1>Fiche d'entretien : tribunal pour enfants de Béthune</h1>
<table><tr><th>Lettre</th><th>Rappelle</th></tr><tr><td>P</td><td>Protéger</td></tr></table>
<svg viewBox="0 0 10 10" role="img"><title>PAS</title><circle cx="5" cy="5" r="4"/></svg>
</body>
</html>
`;

function visualisationRun(html = VISUALISATION) {
  return { fileByName: { 'visualisation.html': html } };
}

async function detectPostings(aiSession: ReturnType<typeof createFakeAiSession>) {
  const { actions, dataDirectory } = await detectRecordedPostings(aiSession);
  return { actions, postingDirectory: path.join(dataDirectory, LEA_POSTINGS_PATH, POSTING_DIRECTORY_NAME) };
}

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runModule(actions: Actions, module: string) {
  const { id } = await actions.runModule({ module, reference: REFERENCE });
  await actions.runQueuedJobs();
  return actions.followJob({ jobId: id });
}

// A Visualisation Version, retenue, from a Fiche d'entretien retenue
async function produceVisualisation(aiSession: ReturnType<typeof createFakeAiSession>) {
  const posting = await detectPostings(aiSession);
  await runModule(posting.actions, 'recherche');
  await runModule(posting.actions, 'fiche');
  await runModule(posting.actions, 'visualisation');
  return posting;
}

describe('visualisation', () => {
  it('produces a new HTML Version at each launch of jf run visualisation, from the Fiche retenue', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, FICHE_RUN, FICHE_RUN, visualisationRun(), visualisationRun());
    const { actions, postingDirectory } = await detectPostings(aiSession);
    await runModule(actions, 'recherche');
    await runModule(actions, 'fiche');
    await runModule(actions, 'fiche');
    await actions.retenirVersion({ reference: REFERENCE, artefact: 'fiche_entretien', number: 1 });

    const job = await runModule(actions, 'visualisation');
    await runModule(actions, 'visualisation');

    expect(job).toMatchObject({ module: 'visualisation', state: 'done' });
    expect(job.version).toMatchObject({
      artefact: 'visualisation',
      number: 1,
      state: 'ready',
      inputList: [{ artefact: 'fiche_entretien', number: 1, posting: { reference: REFERENCE } }],
    });
    expect(readFileSync(path.join(postingDirectory, 'visualisation/v1/visualisation.html'), 'utf8')).toBe(
      VISUALISATION,
    );
    const session = aiSession.headlessSessionList.at(-1);
    // The Fiche d'entretien is in the folder of the Posting, the session's own
    expect(session?.readDirectoryList).toEqual([]);
    expect(session?.fixedPrompt).toContain(
      `\`${path.join(postingDirectory, 'fiche_entretien/v1/fiche-entretien.md')}\``,
    );
    const versionList = await actions.listVersions({ reference: REFERENCE, artefact: 'visualisation' });
    expect(versionList.map(({ number, isRetenue }) => ({ number, isRetenue }))).toEqual([
      { number: 1, isRetenue: false },
      { number: 2, isRetenue: true },
    ]);
  });

  it('asks for the same content as the Fiche, in one page that loads nothing and runs no script', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, FICHE_RUN, visualisationRun());
    const { actions } = await produceVisualisation(aiSession);

    const { fixedPrompt, instructions } = aiSession.headlessSessionList.at(-1) ?? {};
    expect(fixedPrompt).toContain("même contenu que la Fiche d'entretien, mis en forme : n'ajoute aucun fait");
    expect(fixedPrompt).toContain('Aucun JavaScript');
    expect(instructions).toBe(VISUALISATION_DEFAULT_INSTRUCTIONS);
    const [version] = await actions.listVersions({ reference: REFERENCE, artefact: 'visualisation' });
    expect(version?.instructions).toBe(VISUALISATION_DEFAULT_INSTRUCTIONS);
  });

  it("refuses to run without a Fiche d'entretien retenue, before queuing anything", async () => {
    const { actions } = await detectPostings(createFakeAiSession(RECHERCHE_RUN, { isSuccess: false }));
    await runModule(actions, 'recherche');
    await runModule(actions, 'fiche');

    const launch = actions.runModule({ module: 'visualisation', reference: REFERENCE });

    await expect(launch).rejects.toThrow(
      "L'Offre 2026-2445600 n'a pas de Fiche d’entretien retenue, sur laquelle s'appuie la Visualisation. La produire d'abord : jf run fiche_entretien 2026-2445600.",
    );
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  it.each([
    {
      problem: 'is not an HTML page',
      html: "# Fiche d'entretien\n\n## À réviser\n",
      log: "Le fichier visualisation/v1/visualisation.html est mal formé : ce n'est pas une page HTML complète, de « <!DOCTYPE html> » à « </html> ».",
    },
    {
      problem: 'is cut short',
      html: VISUALISATION.replace('</html>', ''),
      log: "Le fichier visualisation/v1/visualisation.html est mal formé : ce n'est pas une page HTML complète, de « <!DOCTYPE html> » à « </html> ».",
    },
    {
      problem: 'holds a script',
      html: VISUALISATION.replace('</body>', '<script src="https://cdn.example.org/mermaid.js"></script></body>'),
      log: "Le fichier visualisation/v1/visualisation.html est mal formé : il contient un script, que le front n'exécute pas.",
    },
  ])('fails the Version of a file that $problem', async ({ html, log }) => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, FICHE_RUN, visualisationRun(html));
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'recherche');
    await runModule(actions, 'fiche');

    const job = await runModule(actions, 'visualisation');

    expect(job).toMatchObject({ state: 'failed', version: { state: 'failed' } });
    expect(job.log).toContain(log);
  });
});

// The Visualisation is regenerated from the Fiche d'entretien, never corrected by hand (spec « Modules IA »)
describe('correcting a Visualisation', () => {
  it('refuses jf edit on the Visualisation, saying to correct the Fiche, without opening a session', async () => {
    const aiSession = createFakeAiSession(RECHERCHE_RUN, FICHE_RUN, visualisationRun());
    const { actions } = await produceVisualisation(aiSession);

    await expect(actions.openArtefact({ reference: REFERENCE, artefact: 'visualisation' })).rejects.toThrow(
      "La Visualisation ne se modifie pas à la main : elle reprend la Fiche d'entretien retenue. Corrigez celle-ci, puis relancez la Visualisation de l'Offre 2026-2445600.",
    );
    expect(aiSession.interactiveSessionList).toEqual([]);
  });

  it('shows the Visualisation on the Posting page without a jf edit command, nor any file to correct', async () => {
    const { actions } = await produceVisualisation(createFakeAiSession(RECHERCHE_RUN, FICHE_RUN, visualisationRun()));

    const { artefactList } = await actions.readPosting({ reference: REFERENCE });

    expect(Object.fromEntries(artefactList.map(({ artefact, isEditable }) => [artefact, isEditable]))).toEqual({
      recherche: true,
      lettre: false,
      fiche_entretien: true,
      visualisation: false,
    });
    expect(artefactList.at(-1)?.versionList).toMatchObject([
      { version: { number: 1, state: 'ready', isRetenue: true }, documentList: [] },
    ]);
  });

  it('leaves the Visualisation out of the Artefacts jf edit offers', async () => {
    const { actions } = await produceVisualisation(createFakeAiSession(RECHERCHE_RUN, FICHE_RUN, visualisationRun()));

    const versionList = await actions.listVersionsRetenues({ reference: REFERENCE });

    expect(versionList.map(({ artefact }) => artefact)).toEqual(['recherche', 'fiche_entretien']);
  });
});

// The front shows each Version of the Visualisation in a frame, served through the actions
describe('reading a Visualisation', () => {
  it('reads the page of each Version', async () => {
    const otherPage = VISUALISATION.replace('<h1>', '<h1>Relancée : ');
    const aiSession = createFakeAiSession(RECHERCHE_RUN, FICHE_RUN, visualisationRun(), visualisationRun(otherPage));
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'recherche');
    await runModule(actions, 'fiche');
    await runModule(actions, 'visualisation');
    await runModule(actions, 'visualisation');

    expect(await actions.readVisualisation({ reference: REFERENCE, number: '1' })).toEqual({ html: VISUALISATION });
    expect(await actions.readVisualisation({ reference: REFERENCE, number: '2' })).toEqual({ html: otherPage });
  });

  it.each([
    {
      case: 'an unknown Version',
      number: '2',
      error:
        "Version inconnue : visualisation v2 de l'Offre 2026-2445600. « jf versions 2026-2445600 visualisation » liste ses Versions.",
    },
    {
      case: 'a Version without its page',
      number: '1',
      error: "La Visualisation v1 de l'Offre 2026-2445600 n'a pas de page : relancez la Visualisation.",
    },
  ])('refuses $case', async ({ number, error }) => {
    const { actions } = await detectPostings(createFakeAiSession(RECHERCHE_RUN, FICHE_RUN, {}));
    await runModule(actions, 'recherche');
    await runModule(actions, 'fiche');
    await runModule(actions, 'visualisation');

    await expect(actions.readVisualisation({ reference: REFERENCE, number })).rejects.toThrow(error);
  });
});
