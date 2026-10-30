import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { catalogueFor } from '#/domain/catalogue/index.ts';

import { detectPostings as detectRecordedPostings, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// Léa's, in French
const { defaultInstructions } = catalogueFor('fr');
const VISUALIZATION_DEFAULT_INSTRUCTIONS = defaultInstructions.visualization;

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';
const POSTING_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RESEARCH_RUN = {
  fileByName: { 'research.md': '# Recherche\n\nLe TJ de Béthune.\n\n## Sources\n\n- https://www.justice.fr/\n' },
};

const BRIEF_RUN = {
  fileByName: {
    'interview-brief.md': [
      "# Fiche d'entretien : tribunal pour enfants de Béthune",
      "## À réviser\n\n- L'assistance éducative.",
      '## Moyens mnémotechniques\n\n- « PAS » : Protéger, Accompagner, Sanctionner.',
      '## Présentez-vous\n\nTitulaire d’un [à compléter : diplôme], je souhaite rejoindre le tribunal pour enfants.',
      '## Questions probables\n\n- Pourquoi le tribunal pour enfants de Béthune ?\n',
    ].join('\n\n'),
  },
};

// The same content as the Interview Brief, as a table and an inline diagram
const VISUALIZATION = `<!DOCTYPE html>
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

function visualizationRun(html = VISUALIZATION) {
  return { fileByName: { 'visualization.html': html } };
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

// A Visualization Version, chosen, from a Chosen Interview Brief
async function produceVisualization(aiSession: ReturnType<typeof createFakeAiSession>) {
  const posting = await detectPostings(aiSession);
  await runModule(posting.actions, 'research');
  await runModule(posting.actions, 'brief');
  await runModule(posting.actions, 'visualization');
  return posting;
}

describe('visualization', () => {
  it('produces a new HTML Version at each launch of jf run visualization, from the Chosen Interview Brief', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, BRIEF_RUN, BRIEF_RUN, visualizationRun(), visualizationRun());
    const { actions, postingDirectory } = await detectPostings(aiSession);
    await runModule(actions, 'research');
    await runModule(actions, 'brief');
    await runModule(actions, 'brief');
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'interview_brief', number: 1 });

    const job = await runModule(actions, 'visualization');
    await runModule(actions, 'visualization');

    expect(job).toMatchObject({ module: 'visualization', state: 'done' });
    expect(job.version).toMatchObject({
      artifact: 'visualization',
      number: 1,
      state: 'ready',
      inputList: [{ artifact: 'interview_brief', number: 1, posting: { reference: REFERENCE } }],
    });
    expect(readFileSync(path.join(postingDirectory, 'visualization/v1/visualization.html'), 'utf8')).toBe(
      VISUALIZATION,
    );
    const session = aiSession.headlessSessionList.at(-1);
    // The Interview Brief is in the folder of the Posting, the session's own
    expect(session?.readDirectoryList).toEqual([]);
    expect(session?.fixedPrompt).toContain(
      `\`${path.join(postingDirectory, 'interview_brief/v1/interview-brief.md')}\``,
    );
    const versionList = await actions.listVersions({ reference: REFERENCE, artifact: 'visualization' });
    expect(versionList.map(({ number, isChosen }) => ({ number, isChosen }))).toEqual([
      { number: 1, isChosen: false },
      { number: 2, isChosen: true },
    ]);
  });

  it('asks for the same content as the Interview Brief, in one page that loads nothing and runs no script', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, BRIEF_RUN, visualizationRun());
    const { actions } = await produceVisualization(aiSession);

    const { fixedPrompt, instructions } = aiSession.headlessSessionList.at(-1) ?? {};
    expect(fixedPrompt).toContain('same content as the Interview Brief, laid out: add no fact');
    expect(fixedPrompt).toContain('No JavaScript');
    expect(instructions).toBe(VISUALIZATION_DEFAULT_INSTRUCTIONS);
    const [version] = await actions.listVersions({ reference: REFERENCE, artifact: 'visualization' });
    expect(version?.instructions).toBe(VISUALIZATION_DEFAULT_INSTRUCTIONS);
  });

  it('refuses to run without a Chosen Interview Brief, before queuing anything', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, { isSuccess: false }));
    await runModule(actions, 'research');
    await runModule(actions, 'brief');

    const launch = actions.runModule({ module: 'visualization', reference: REFERENCE });

    await expect(launch).rejects.toThrow(
      "L'Offre 2026-2445600 n'a pas de Fiche d’entretien retenue, sur laquelle s'appuie la Visualisation. La produire d'abord : jf run interview_brief 2026-2445600.",
    );
    expect(await actions.runQueuedJobs()).toEqual([]);
  });

  it.each([
    {
      problem: 'is not an HTML page',
      html: "# Fiche d'entretien\n\n## À réviser\n",
      log: "Le fichier visualization/v1/visualization.html est mal formé : ce n'est pas une page HTML complète, de « <!DOCTYPE html> » à « </html> ».",
    },
    {
      problem: 'is cut short',
      html: VISUALIZATION.replace('</html>', ''),
      log: "Le fichier visualization/v1/visualization.html est mal formé : ce n'est pas une page HTML complète, de « <!DOCTYPE html> » à « </html> ».",
    },
    {
      problem: 'holds a script',
      html: VISUALIZATION.replace('</body>', '<script src="https://cdn.example.org/mermaid.js"></script></body>'),
      log: "Le fichier visualization/v1/visualization.html est mal formé : il contient un script, que le front n'exécute pas.",
    },
  ])('fails the Version of a file that $problem', async ({ html, log }) => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, BRIEF_RUN, visualizationRun(html));
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'research');
    await runModule(actions, 'brief');

    const job = await runModule(actions, 'visualization');

    expect(job).toMatchObject({ state: 'failed', version: { state: 'failed' } });
    expect(job.log).toContain(log);
  });
});

// The Visualization is regenerated from the Interview Brief, never corrected by hand (spec « Modules IA »)
describe('correcting a Visualization', () => {
  it('refuses jf edit on the Visualization, saying to correct the Interview Brief, without opening a session', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, BRIEF_RUN, visualizationRun());
    const { actions } = await produceVisualization(aiSession);

    await expect(actions.openArtifact({ reference: REFERENCE, artifact: 'visualization' })).rejects.toThrow(
      "La Visualisation ne se modifie pas à la main : elle reprend la Fiche d'entretien retenue. Corrigez celle-ci, puis relancez la Visualisation de l'Offre 2026-2445600.",
    );
    expect(aiSession.interactiveSessionList).toEqual([]);
  });

  it('shows the Visualization on the Posting page without a jf edit command, nor any file to correct', async () => {
    const { actions } = await produceVisualization(createFakeAiSession(RESEARCH_RUN, BRIEF_RUN, visualizationRun()));

    const { artifactList } = await actions.readPosting({ reference: REFERENCE });

    expect(Object.fromEntries(artifactList.map(({ artifact, isEditable }) => [artifact, isEditable]))).toEqual({
      research: true,
      letter: false,
      interview_brief: true,
      visualization: false,
    });
    expect(artifactList.at(-1)?.versionList).toMatchObject([
      { version: { number: 1, state: 'ready', isChosen: true }, documentList: [] },
    ]);
  });

  it('leaves the Visualization out of the Artifacts jf edit offers', async () => {
    const { actions } = await produceVisualization(createFakeAiSession(RESEARCH_RUN, BRIEF_RUN, visualizationRun()));

    const versionList = await actions.listChosenVersions({ reference: REFERENCE });

    expect(versionList.map(({ artifact }) => artifact)).toEqual(['research', 'interview_brief']);
  });
});

// The front shows each Version of the Visualization in a frame, served through the actions
describe('reading a Visualization', () => {
  it('reads the page of each Version', async () => {
    const otherPage = VISUALIZATION.replace('<h1>', '<h1>Relancée : ');
    const aiSession = createFakeAiSession(RESEARCH_RUN, BRIEF_RUN, visualizationRun(), visualizationRun(otherPage));
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'research');
    await runModule(actions, 'brief');
    await runModule(actions, 'visualization');
    await runModule(actions, 'visualization');

    expect(await actions.readVisualization({ reference: REFERENCE, number: '1' })).toEqual({ html: VISUALIZATION });
    expect(await actions.readVisualization({ reference: REFERENCE, number: '2' })).toEqual({ html: otherPage });
  });

  it.each([
    {
      case: 'an unknown Version',
      number: '2',
      error:
        "Version inconnue : visualization v2 de l'Offre 2026-2445600. « jf versions 2026-2445600 visualization » liste ses Versions.",
    },
    {
      case: 'a Version without its page',
      number: '1',
      error: "La Visualisation v1 de l'Offre 2026-2445600 n'a pas de page : relancez la Visualisation.",
    },
  ])('refuses $case', async ({ number, error }) => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, BRIEF_RUN, {}));
    await runModule(actions, 'research');
    await runModule(actions, 'brief');
    await runModule(actions, 'visualization');

    await expect(actions.readVisualization({ reference: REFERENCE, number })).rejects.toThrow(error);
  });
});
