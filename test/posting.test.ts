import { describe, expect, it } from 'vitest';

import { detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { runAndValidate } from './run-module.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const RESEARCH = '# Recherche : le tribunal pour enfants de Béthune\n\n## Sources\n\n- https://www.justice.fr/\n';

const RECIPIENTS = {
  to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
  ccList: [{ email: 'sec.p.tj-bethune@justice.fr', source: 'contact2' }],
  salutation: { text: 'Madame la Présidente,', source: 'contact1' },
  justification: 'Le mail de candidature est celui de la présidence ; le contact 2 demande le secrétariat en copie.',
};

describe('the Posting page', () => {
  it('reads a Posting with its raw contacts and its Job Description', async () => {
    const { actions } = await detectPostings();

    const { posting, jobDescription } = await actions.readPosting({ reference: REFERENCE });

    expect(posting).toMatchObject({
      reference: REFERENCE,
      applicationEmail: 'p.tj-bethune@justice.fr',
      contact1: 'Madame Odile SIMART, présidente du Tribunal Judiciaire de Béthune',
      contact2: 'secrétariat en copie : sec.p.tj-bethune@justice.fr',
    });
    expect(jobDescription).toContain(
      'La présente fiche de poste concerne une affectation auprès du tribunal pour enfants.',
    );
  });

  it('reads every Version of each Artifact with its text and Original, and tells the Chosen Version', async () => {
    const { actions } = await detectPostings(
      createFakeAiSession({ fileByName: { 'research.md': RESEARCH } }, { isSuccess: false }),
    );
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runModule({ module: 'research', reference: REFERENCE });
    await actions.runQueuedJobs();
    await actions.validateVersion({ reference: REFERENCE, artifact: 'research', number: 1 });

    const { artifactList } = await actions.readPosting({ reference: REFERENCE });

    // The Interview Brief is attached to an Interview, which a To Apply Posting lacks
    expect(artifactList.map(({ artifact }) => artifact)).toEqual(['research', 'letter']);
    expect(artifactList[0]?.versionList).toMatchObject([
      {
        version: { number: 1, state: 'ready', validation: 'validated', isChosen: true },
        text: RESEARCH,
        original: RESEARCH,
        isValidatable: false,
      },
      { version: { number: 2, state: 'failed', isChosen: false }, text: null, original: null, isValidatable: false },
    ]);
    expect(artifactList[1]?.versionList).toEqual([]);
  });

  it('reads the recipients the Chosen Letter recommends, none before it exists', async () => {
    const { actions } = await detectPostings(
      createFakeAiSession(
        { fileByName: { 'research.md': RESEARCH } },
        { fileByName: { 'letter.md': 'Madame la Présidente,\n', 'recipients.json': JSON.stringify(RECIPIENTS) } },
      ),
    );
    await runAndValidate(actions, { module: 'research', reference: REFERENCE });
    const before = await actions.readPosting({ reference: REFERENCE });
    await runAndValidate(actions, { module: 'letter', reference: REFERENCE });

    const { recipients } = await actions.readPosting({ reference: REFERENCE });

    expect(before.recipients).toBeNull();
    expect(recipients).toEqual(RECIPIENTS);
  });

  it('refuses an unknown reference', async () => {
    const { actions } = await detectPostings();

    await expect(actions.readPosting({ reference: '2026-0000000' })).rejects.toThrow('Offre inconnue : 2026-0000000');
  });
});
