import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { catalogueOf } from '#/domain/catalogue/index.ts';

import { detectPostings as detectRecordedPostings, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// Léa's, in French
const { defaultInstructions } = catalogueOf({ locale: 'fr' });
const LETTER_DEFAULT_INSTRUCTIONS = defaultInstructions.letter;

// Béthune, tribunal pour enfants: mail p.tj-bethune@justice.fr, contact 1 the présidente, contact 2
// « secrétariat en copie : sec.p.tj-bethune@justice.fr » (responses recorded on 2026-10-29)
const REFERENCE = '2026-2445600';
const POSTING_DIRECTORY_NAME =
  '2026-2445600-attache-de-justice-affecte-aupres-des-magistrats-du-siege-tribunal-pour-enfants-tj-bethune';

const RESEARCH_RUN = {
  fileByName: {
    'research.md':
      '# Recherche\n\nLe TJ de Béthune ([justice.fr](https://www.justice.fr/)).\n\n## Sources\n\n- https://www.justice.fr/\n',
  },
};

const DRAFT = `Madame la Présidente,

Titulaire d'un [à compléter : diplôme et année d'obtention], je souhaite rejoindre le tribunal pour enfants de Béthune.
`;

const RECIPIENTS = {
  to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
  ccList: [{ email: 'sec.p.tj-bethune@justice.fr', source: 'contact2' }],
  salutation: { text: 'Madame la Présidente,', source: 'contact1' },
  justification: 'Le mail de candidature est celui de la présidence ; le contact 2 demande le secrétariat en copie.',
};

function letterRun(recipients: object = RECIPIENTS) {
  return { fileByName: { 'draft.md': DRAFT, 'recipients.json': JSON.stringify(recipients, undefined, 2) } };
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

// Two other Postings of Léa: the second Béthune siège Posting and the Béthune parquet one
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

async function detectPostings(aiSession: ReturnType<typeof createFakeAiSession>) {
  const { actions, dataDirectory } = await detectRecordedPostings(aiSession);
  return {
    actions,
    dataDirectory,
    postingDirectory: path.join(dataDirectory, LEA_POSTINGS_PATH, POSTING_DIRECTORY_NAME),
  };
}

// Launching a module queues its job, which the worker runs (ADR-0003)
async function runModule(actions: Actions, module: string, reference: string) {
  const { id } = await actions.runModule({ module, reference });
  await actions.runQueuedJobs();
  return actions.followJob({ jobId: id });
}

describe('letter', () => {
  it('produces a Version holding the Draft, the Letter as its copy, and the recommended recipients', async () => {
    const { actions, postingDirectory } = await detectPostings(createFakeAiSession(RESEARCH_RUN, letterRun()));
    await runModule(actions, 'research', REFERENCE);

    const job = await runModule(actions, 'letter', REFERENCE);

    expect(job).toMatchObject({ module: 'letter', state: 'done' });
    expect(job.version).toMatchObject({ artifact: 'letter', number: 1, state: 'ready', isChosen: true });
    expect(readFileSync(path.join(postingDirectory, 'letter/v1/letter.md'), 'utf8')).toBe(DRAFT);
    expect(readFileSync(path.join(postingDirectory, 'letter/v1/draft.md'), 'utf8')).toBe(DRAFT);
    expect(await actions.readRecipients({ reference: REFERENCE })).toEqual(RECIPIENTS);
  });

  it('creates a new pair at each launch, and makes each Draft read-only', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, letterRun(), letterRun());
    const { actions, postingDirectory } = await detectPostings(aiSession);
    await runModule(actions, 'research', REFERENCE);

    await runModule(actions, 'letter', REFERENCE);
    await runModule(actions, 'letter', REFERENCE);

    const versionList = await actions.listVersions({ reference: REFERENCE, artifact: 'letter' });
    expect(versionList.map(({ number, isChosen }) => ({ number, isChosen }))).toEqual([
      { number: 1, isChosen: false },
      { number: 2, isChosen: true },
    ]);
    for (const version of ['v1', 'v2']) {
      const draftPath = path.join(postingDirectory, 'letter', version, 'draft.md');
      expect(statSync(draftPath).mode & 0o222).toBe(0);
      expect(statSync(path.join(postingDirectory, 'letter', version, 'letter.md')).mode & 0o200).toBe(0o200);
    }
  });

  it('reads the Job Description, the Chosen Research, the Profile and the pairs of the Postings already Applied', async () => {
    const aiSession = createFakeAiSession(
      RESEARCH_RUN,
      letterRun(),
      RESEARCH_RUN,
      letterRun(UNSENT_RECIPIENTS),
      RESEARCH_RUN,
      RESEARCH_RUN,
      letterRun(),
    );
    const { actions, dataDirectory, postingDirectory } = await detectPostings(aiSession);
    await runModule(actions, 'research', SENT_REFERENCE);
    await runModule(actions, 'letter', SENT_REFERENCE);
    await actions.changeStatus({ reference: SENT_REFERENCE, status: 'applied' });
    await runModule(actions, 'research', UNSENT_REFERENCE);
    await runModule(actions, 'letter', UNSENT_REFERENCE);
    await runModule(actions, 'research', REFERENCE);
    await runModule(actions, 'research', REFERENCE);
    await actions.chooseVersion({ reference: REFERENCE, artifact: 'research', number: 1 });

    const { version } = await runModule(actions, 'letter', REFERENCE);

    const profileDirectory = path.join(dataDirectory, 'candidates/lea/profile');
    const sentDirectory = path.join(dataDirectory, 'candidates/lea/postings', SENT_DIRECTORY_NAME, 'letter/v1');
    const session = aiSession.headlessSessionList.at(-1);
    // The folder of the Posting is the session's own: only the folders outside it are added
    expect(session?.readDirectoryList).toEqual([profileDirectory, sentDirectory]);
    expect(session?.fixedPrompt).toContain('`job-description.md`');
    expect(session?.fixedPrompt).toContain(`\`${path.join(postingDirectory, 'research/v1/research.md')}\``);
    expect(session?.fixedPrompt).toContain(`\`${profileDirectory}\``);
    expect(session?.fixedPrompt).toContain(`\`${sentDirectory}\``);
    expect(session?.fixedPrompt).not.toContain(UNSENT_REFERENCE);
    expect(version?.inputList).toHaveLength(2);
    expect(version?.inputList).toEqual(
      expect.arrayContaining([
        { artifact: 'research', number: 1, posting: { reference: REFERENCE } },
        { artifact: 'letter', number: 1, posting: { reference: SENT_REFERENCE } },
      ]),
    );
  });
});

describe('the prompt of the Letter', () => {
  it('forbids inventing a fact on the Candidate and marks each missing one « [à compléter : …] »', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, letterRun());
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'research', REFERENCE);

    const { version } = await runModule(actions, 'letter', REFERENCE);

    const { fixedPrompt, instructions } = aiSession.headlessSessionList[1] ?? {};
    expect(fixedPrompt).toContain('Never invent a fact about the Candidate');
    expect(fixedPrompt).toContain('`[à compléter : …]`');
    expect(instructions).toBe(LETTER_DEFAULT_INSTRUCTIONS);
    expect(version?.instructions).toBe(LETTER_DEFAULT_INSTRUCTIONS);
  });

  it("replaces the default Instructions with the Candidate's own, keeping the fixed part", async () => {
    const instructions = 'Une lettre courte, trois paragraphes au plus.\n';
    const aiSession = createFakeAiSession(RESEARCH_RUN, letterRun());
    const { actions, dataDirectory } = await detectPostings(aiSession);
    mkdirSync(path.join(dataDirectory, 'candidates/lea/instructions'));
    writeFileSync(path.join(dataDirectory, 'candidates/lea/instructions/letter.md'), instructions);
    await runModule(actions, 'research', REFERENCE);

    const { version } = await runModule(actions, 'letter', REFERENCE);

    expect(aiSession.headlessSessionList[1]?.instructions).toBe(instructions);
    expect(aiSession.headlessSessionList[1]?.fixedPrompt).toContain('Never invent a fact about the Candidate');
    expect(version?.instructions).toBe(instructions);
  });
});

describe('the recommended recipients', () => {
  it('reads a mail de candidature written as free text, as in Avesnes', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, letterRun(AVESNES_RECIPIENTS));
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'research', AVESNES_REFERENCE);

    const { version } = await runModule(actions, 'letter', AVESNES_REFERENCE);

    expect(aiSession.headlessSessionList[1]?.fixedPrompt).toContain(`"${AVESNES_APPLICATION_EMAIL}"`);
    expect(version?.state).toBe('ready');
    expect(await actions.readRecipients({ reference: AVESNES_REFERENCE })).toEqual(AVESNES_RECIPIENTS);
  });

  it.each([
    {
      problem: 'the free text is kept as the address',
      recipients: { ...AVESNES_RECIPIENTS, to: { email: AVESNES_APPLICATION_EMAIL, source: 'applicationEmail' } },
      log: /recipients\.json est mal formé/,
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
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, letterRun(recipients)));
    await runModule(actions, 'research', AVESNES_REFERENCE);

    const { log, version } = await runModule(actions, 'letter', AVESNES_REFERENCE);

    expect(log).toMatch(expectedLog);
    expect(version).toMatchObject({ state: 'failed', isChosen: false });
  });

  it('has none for a Posting without a Chosen Letter', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, {}));
    await runModule(actions, 'research', REFERENCE);
    await runModule(actions, 'letter', REFERENCE);

    await expect(actions.readRecipients({ reference: REFERENCE })).rejects.toThrow(
      /L'Offre 2026-2445600 n'a pas de Lettre retenue/,
    );
  });
});

describe('a Letter that fails', () => {
  it.each([
    { file: 'draft.md', plannedRun: { fileByName: { 'recipients.json': JSON.stringify(RECIPIENTS) } } },
    { file: 'recipients.json', plannedRun: { fileByName: { 'draft.md': DRAFT } } },
  ])('puts the Version « en échec », without a Letter, when $file is absent', async ({ file, plannedRun }) => {
    const { actions, postingDirectory } = await detectPostings(createFakeAiSession(RESEARCH_RUN, plannedRun));
    await runModule(actions, 'research', REFERENCE);

    const { log, version } = await runModule(actions, 'letter', REFERENCE);

    expect(log).toContain(`Le fichier attendu ${path.join('letter/v1', file)} est absent.`);
    expect(version).toMatchObject({ state: 'failed', isChosen: false });
    expect(existsSync(path.join(postingDirectory, 'letter/v1/letter.md'))).toBe(false);
  });

  it('puts the Version « en échec » when its recipients are not JSON', async () => {
    const plannedRun = {
      fileByName: { 'draft.md': DRAFT, 'recipients.json': 'à : p.tj-bethune@justice.fr' },
    };
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, plannedRun));
    await runModule(actions, 'research', REFERENCE);

    const job = await runModule(actions, 'letter', REFERENCE);

    expect(job).toMatchObject({ state: 'failed', log: /recipients\.json est mal formé/ });
  });
});

describe('a Letter refused', () => {
  it.each([
    { case: 'no Research', researchRunList: [] },
    { case: 'only a Recherche « en échec »', researchRunList: [{}] },
  ])('refuses to run without a Chosen Research ($case), without launching Claude', async ({ researchRunList }) => {
    const aiSession = createFakeAiSession(...researchRunList);
    const { actions } = await detectPostings(aiSession);
    if (researchRunList.length > 0) {
      await runModule(actions, 'research', REFERENCE);
    }

    await expect(actions.runModule({ module: 'letter', reference: REFERENCE })).rejects.toThrow(
      /L'Offre 2026-2445600 n'a pas de Recherche retenue.*jf run research 2026-2445600/,
    );
    expect(aiSession.headlessSessionList).toHaveLength(researchRunList.length);
    expect(await actions.listVersions({ reference: REFERENCE, artifact: 'letter' })).toEqual([]);
  });

  // An Applied Posting keeps the Letter that was sent (spec « Versions »)
  it('refuses to produce a new Letter for an Applied Posting, without launching Claude', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, letterRun(), letterRun());
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'research', REFERENCE);
    await runModule(actions, 'letter', REFERENCE);
    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });

    await expect(actions.runModule({ module: 'letter', reference: REFERENCE })).rejects.toThrow(
      /L'Offre 2026-2445600 a été Postulée : sa Lettre retenue est figée/,
    );
    expect(aiSession.headlessSessionList).toHaveLength(2);
    const versionList = await actions.listVersions({ reference: REFERENCE, artifact: 'letter' });
    expect(versionList.map(({ number, isChosen }) => ({ number, isChosen }))).toEqual([{ number: 1, isChosen: true }]);
  });

  it('fails a Letter queued before the Posting became Applied, without launching Claude', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, letterRun());
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'research', REFERENCE);
    const { id } = await actions.runModule({ module: 'letter', reference: REFERENCE });
    await actions.changeStatus({ reference: REFERENCE, status: 'applied' });

    await actions.runQueuedJobs();

    expect(await actions.followJob({ jobId: id })).toMatchObject({
      state: 'failed',
      version: null,
      log: /L'Offre 2026-2445600 a été Postulée : sa Lettre retenue est figée/,
    });
    expect(aiSession.headlessSessionList).toHaveLength(1);
    expect(await actions.listVersions({ reference: REFERENCE, artifact: 'letter' })).toEqual([]);
  });
});
