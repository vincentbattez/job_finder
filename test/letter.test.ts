import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Actions } from '#/actions/index.ts';
import { promptOf } from '#/artifact/prompt.ts';
import { DEFAULT_INSTRUCTIONS_FR } from '#/domain/catalogue/fr/default-instructions.ts';

import { applyTo } from './apply.ts';
import { detectPostings as detectRecordedPostings, LEA_POSTINGS_PATH } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { markedValuesOf } from './marked-values.ts';
import { runAndValidate } from './run-module.ts';

// Léa's, in French
const LETTER_DEFAULT_INSTRUCTIONS = DEFAULT_INSTRUCTIONS_FR.letter;

// Béthune, juvenile court: mail p.tj-bethune@justice.fr, contact 1 the president, contact 2 the
// secretariat in copy, sec.p.tj-bethune@justice.fr (responses recorded on 2026-10-29)
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
  return { fileByName: { 'letter.md': DRAFT, 'recipients.json': JSON.stringify(recipients, undefined, 2) } };
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

// Two other Postings of Léa: the second Béthune bench Posting and the Béthune prosecution one
const SENT_REFERENCE = '2026-2445609';
const UNSENT_REFERENCE = '2026-2445183';
const UNSENT_RECIPIENTS = {
  to: { email: 'chcab.pr.tj-bethune@justice.fr', source: 'applicationEmail' },
  ccList: [],
  salutation: { text: 'Monsieur le Procureur de la République,', source: null },
  justification: 'Le mail de candidature est celui du cabinet du procureur.',
};

// Léa's Profile: her CV, a past letter and an Annex, which a run reads only once checked
const CV = '# Léa Martin\n\nMaster 2 de droit privé, Université de Lille, 2025.\n';
const PAST_LETTER = 'Madame la Présidente,\n\nJe souhaite rejoindre le tribunal judiciaire de Lille.\n';

function writeProfile(dataDirectory: string): void {
  const profileDirectory = path.join(dataDirectory, 'candidates/lea/profile');
  writeFileSync(path.join(profileDirectory, 'cv.md'), CV);
  writeFileSync(path.join(profileDirectory, 'letter-tj-lille-2025.md'), PAST_LETTER);
  writeFileSync(path.join(profileDirectory, 'annex-memoire.md'), '# Mémoire\n\nLa justice des mineurs.\n');
}

// The Letter as Léa corrected then sent it, its Draft kept as the Original
const SENT = `Madame la Présidente,

Titulaire d'un master 2 de droit privé, je souhaite rejoindre le service de l'instruction de Béthune.
`;

async function detectPostings(aiSession: ReturnType<typeof createFakeAiSession>) {
  const { actions, dataDirectory } = await detectRecordedPostings(aiSession);
  return {
    actions,
    dataDirectory,
    postingDirectory: path.join(dataDirectory, LEA_POSTINGS_PATH, POSTING_DIRECTORY_NAME),
  };
}

async function runModule(actions: Actions, module: string, reference: string) {
  return runAndValidate(actions, { module, reference });
}

describe('letter', () => {
  it('produces a Version holding the Letter, its Original and the recommended recipients', async () => {
    const { actions, postingDirectory } = await detectPostings(createFakeAiSession(RESEARCH_RUN, letterRun()));
    await runModule(actions, 'research', REFERENCE);

    const job = await runModule(actions, 'letter', REFERENCE);

    expect(job).toMatchObject({ module: 'letter', state: 'done' });
    expect(job.version).toMatchObject({ artifact: 'letter', number: 1, state: 'ready', isChosen: true });
    expect(readFileSync(path.join(postingDirectory, 'letter/v1/letter.md'), 'utf8')).toBe(DRAFT);
    expect(readFileSync(path.join(postingDirectory, 'letter/v1/original.md'), 'utf8')).toBe(DRAFT);
    expect(await actions.readRecipients({ reference: REFERENCE })).toEqual(RECIPIENTS);
  });

  it('creates a new pair at each launch, and makes each Original read-only', async () => {
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
      const originalPath = path.join(postingDirectory, 'letter', version, 'original.md');
      expect(statSync(originalPath).mode & 0o222).toBe(0);
      expect(statSync(path.join(postingDirectory, 'letter', version, 'letter.md')).mode & 0o200).toBe(0o200);
    }
  });

  it('receives inlined the Job Description, the Chosen Research, the Profile and each Letter sent with its Original', async () => {
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
    writeProfile(dataDirectory);
    await runModule(actions, 'research', SENT_REFERENCE);
    await runModule(actions, 'letter', SENT_REFERENCE);
    await actions.saveDocument({
      reference: SENT_REFERENCE,
      artifact: 'letter',
      number: 1,
      fileName: 'letter.md',
      markdown: SENT,
    });
    await applyTo(actions, SENT_REFERENCE);
    await runModule(actions, 'research', UNSENT_REFERENCE);
    await runModule(actions, 'letter', UNSENT_REFERENCE);
    await runModule(actions, 'research', REFERENCE);
    await runModule(actions, 'research', REFERENCE);
    await actions.validateVersion({ reference: REFERENCE, artifact: 'research', number: 1 });

    const { version } = await runModule(actions, 'letter', REFERENCE);

    const session = aiSession.headlessSessionList.at(-1);
    const jobDescription = readFileSync(path.join(postingDirectory, 'job-description.md'), 'utf8');
    expect(session?.message).toBe(
      [
        '# Inputs',
        `## Input: Job Description\n\n${jobDescription.trim()}`,
        `## Input: Chosen Research\n\n${RESEARCH_RUN.fileByName['research.md'].trim()}`,
        `## Input: Profile: cv.md\n\n${CV.trim()}`,
        `## Input: Past Letter: letter-tj-lille-2025.md\n\n${PAST_LETTER.trim()}`,
        `## Input: Letter sent for Posting ${SENT_REFERENCE}\n\n### As sent\n\n${SENT.trim()}\n\n### Its Original, as the AI wrote it\n\n${DRAFT.trim()}`,
        '# Instructions',
        LETTER_DEFAULT_INSTRUCTIONS.trim(),
      ].join('\n\n'),
    );
    // The session reads no Input from disk (ADR-0021): no path, no folder, an Annex only once checked
    expect(session?.fixedPrompt).not.toMatch(/job-description\.md|research\.md|profile|annex|uploads/);
    // It writes its Version only: no folder to read, no web to search
    expect(session).toMatchObject({ isReadingDirectory: false, isSearchingWeb: false });
    expect(session?.fixedPrompt).not.toContain(UNSENT_REFERENCE);
    expect(version?.inputList).toEqual([
      { key: 'job_description', readVersion: null },
      {
        key: 'artifact:research',
        readVersion: {
          artifact: 'research',
          number: 1,
          posting: { reference: REFERENCE },
          interview: null,
          customArtifact: null,
        },
      },
      { key: 'profile:cv.md', readVersion: null },
      { key: 'profile:letter-tj-lille-2025.md', readVersion: null },
      {
        key: `posting:${SENT_REFERENCE}/letter`,
        readVersion: {
          artifact: 'letter',
          number: 1,
          posting: { reference: SENT_REFERENCE },
          interview: null,
          customArtifact: null,
        },
      },
    ]);
  });

  it('is the one its preview composes, with the Posting and its contacts marked where they are substituted', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, letterRun(AVESNES_RECIPIENTS));
    const { actions, dataDirectory } = await detectPostings(aiSession);
    writeProfile(dataDirectory);
    await runModule(actions, 'research', AVESNES_REFERENCE);
    const { artifactList } = await actions.readPosting({ reference: AVESNES_REFERENCE });
    const prompt = artifactList.find(({ artifact }) => artifact === 'letter')?.module.prompt;

    await runModule(actions, 'letter', AVESNES_REFERENCE);

    const session = aiSession.headlessSessionList.at(-1);
    expect(prompt?.prompt.replaceAll('letter/v<next>', 'letter/v1')).toBe(session && promptOf(session));
    expect(markedValuesOf(prompt?.markedFixedPart)).toEqual([
      AVESNES_REFERENCE,
      "Attaché de justice affecté auprès des magistrats du parquet - TJ d'Avesnes-sur-Helpe",
      "Tribunal judiciaire d'Avesnes sur Helpe / Cour d'appel de Douai",
      "11 rue du Maréchal Joffre, 59440 - TJ d'Avesnes-sur-Helpe",
      `"${AVESNES_APPLICATION_EMAIL}"`,
      '"Secrétariat du Procureur : sec.pr.tj-avesnes-sur-helpe@justice.fr"',
      'not given',
      'letter/v<next>/letter.md',
      'letter/v<next>/recipients.json',
    ]);
  });
});

describe('the generation panel of the Letter', () => {
  const CHECKED_KEY_LIST = ['job_description', 'artifact:research', 'profile:cv.md', 'profile:annex-memoire.md'];

  it('runs with the Inputs the Candidate checked, the very Prompt the panel copies', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, letterRun());
    const { actions, dataDirectory } = await detectPostings(aiSession);
    writeProfile(dataDirectory);
    await runModule(actions, 'research', REFERENCE);
    const opened = await actions.readGeneration({ reference: REFERENCE, artifact: 'letter' });

    const generation = await actions.readGeneration({
      reference: REFERENCE,
      artifact: 'letter',
      inputKeyList: CHECKED_KEY_LIST,
    });
    await actions.runModule({ module: 'letter', reference: REFERENCE, inputKeyList: CHECKED_KEY_LIST });
    await actions.runQueuedJobs();

    // Opened, the panel checks the defaults: the past letter, not the Annex
    expect(opened.inputList.map(({ key, isChecked }) => `${key} ${String(isChecked)}`)).toEqual([
      'job_description true',
      'artifact:research true',
      'profile:cv.md true',
      'profile:letter-tj-lille-2025.md true',
      'profile:annex-memoire.md false',
    ]);
    expect(generation).toMatchObject({ refusal: null, nextNumber: 1, chosenNumber: null });
    const session = aiSession.headlessSessionList.at(-1);
    expect(generation.prompt?.prompt.replaceAll('letter/v<next>', 'letter/v1')).toBe(session && promptOf(session));
    expect(session?.message).toContain('La justice des mineurs.');
    expect(session?.message).not.toContain('tribunal judiciaire de Lille');
  });

  it('tells why the Letter cannot run yet, without a Prompt', async () => {
    const { actions } = await detectPostings(createFakeAiSession());

    const generation = await actions.readGeneration({ reference: REFERENCE, artifact: 'letter' });

    expect(generation.refusal).toMatch(/Recherche/);
    expect(generation.prompt).toBeNull();
    expect(generation.inputList.find(({ key }) => key === 'artifact:research')).toMatchObject({
      mode: 'required',
      isAvailable: false,
    });
  });
});

describe('the prompt of the Letter', () => {
  it('forbids inventing a fact on the Candidate and marks each missing one « [à compléter : …] »', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, letterRun());
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'research', REFERENCE);

    const { version } = await runModule(actions, 'letter', REFERENCE);

    const { fixedPrompt, message } = aiSession.headlessSessionList[1] ?? {};
    expect(fixedPrompt).toContain('Never invent a fact about the Candidate');
    expect(fixedPrompt).toContain('`[à compléter : …]`');
    expect(message?.endsWith(`# Instructions\n\n${LETTER_DEFAULT_INSTRUCTIONS.trim()}`)).toBe(true);
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

    expect(aiSession.headlessSessionList[1]?.message).toMatch(
      /# Instructions\n\nUne lettre courte, trois paragraphes au plus\.$/,
    );
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
    { file: 'letter.md', plannedRun: { fileByName: { 'recipients.json': JSON.stringify(RECIPIENTS) } } },
    { file: 'recipients.json', plannedRun: { fileByName: { 'letter.md': DRAFT } } },
  ])('puts the Version « en échec », without an Original, when $file is absent', async ({ file, plannedRun }) => {
    const { actions, postingDirectory } = await detectPostings(createFakeAiSession(RESEARCH_RUN, plannedRun));
    await runModule(actions, 'research', REFERENCE);

    const { log, version } = await runModule(actions, 'letter', REFERENCE);

    expect(log).toContain(`Le fichier attendu ${path.join('letter/v1', file)} est absent.`);
    expect(version).toMatchObject({ state: 'failed', isChosen: false });
    expect(existsSync(path.join(postingDirectory, 'letter/v1/original.md'))).toBe(false);
  });

  it('fails the Version when its recipients are not JSON', async () => {
    const plannedRun = {
      fileByName: { 'letter.md': DRAFT, 'recipients.json': 'à : p.tj-bethune@justice.fr' },
    };
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, plannedRun));
    await runModule(actions, 'research', REFERENCE);

    const job = await runModule(actions, 'letter', REFERENCE);

    expect(job).toMatchObject({ state: 'failed', log: /recipients\.json est mal formé/ });
  });
});

describe('a Letter refused', () => {
  it('fails a Letter queued before the Posting became Applied, without launching Claude', async () => {
    const aiSession = createFakeAiSession(RESEARCH_RUN, letterRun());
    const { actions } = await detectPostings(aiSession);
    await runModule(actions, 'research', REFERENCE);
    const { id } = await actions.runModule({ module: 'letter', reference: REFERENCE });
    await applyTo(actions, REFERENCE);

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
