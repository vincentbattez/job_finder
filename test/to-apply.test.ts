import { describe, expect, it } from 'vitest';

import { detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';
import { runAndValidate } from './run-module.ts';

// Postings detected from the responses recorded on 2026-10-29: Béthune juvenile court, Rennes, Melun
const BETHUNE_REFERENCE = '2026-2445600';
const RENNES_REFERENCE = '2026-2420931';
const ARCHIVED_REFERENCE = '2026-2290529';
const APPLIED_REFERENCE = '2026-2285305';

const RESEARCH_RUN = { fileByName: { 'research.md': '# Recherche\n\n## Sources\n\n- https://www.justice.fr/\n' } };
const LETTER_RUN = {
  fileByName: {
    'letter.md': 'Madame la Présidente,\n\nJe souhaite rejoindre le tribunal pour enfants de Béthune.\n',
    'recipients.json': JSON.stringify({
      to: { email: 'p.tj-bethune@justice.fr', source: 'applicationEmail' },
      ccList: [],
      salutation: { text: 'Madame la Présidente,', source: 'contact1' },
      justification: 'Le mail de candidature est celui de la présidence.',
    }),
  },
};

// The To Apply list: what the Candidate prepares, with where its Research and Letter stand (ADR-0019)
describe('To Apply list', () => {
  it('lists the followed To Apply Postings, each with the state of its Research and its Letter', async () => {
    const { actions } = await detectPostings(createFakeAiSession(RESEARCH_RUN, LETTER_RUN, RESEARCH_RUN));
    await runAndValidate(actions, { module: 'research', reference: BETHUNE_REFERENCE });
    await runAndValidate(actions, { module: 'letter', reference: BETHUNE_REFERENCE });
    // A second Research, a Draft while the Candidate keeps the first one chosen
    await actions.runModule({ module: 'research', reference: BETHUNE_REFERENCE });
    await actions.runQueuedJobs();
    await actions.archive({ reference: ARCHIVED_REFERENCE });
    await actions.changeStatus({ reference: APPLIED_REFERENCE, status: 'applied' });

    const itemList = await actions.listToApply({ candidateId: 'lea' });

    const referenceList = itemList.map(({ posting }) => posting.reference);
    expect(referenceList).toContain(RENNES_REFERENCE);
    expect(referenceList).not.toContain(ARCHIVED_REFERENCE);
    expect(referenceList).not.toContain(APPLIED_REFERENCE);
    // The latest Research waits as a Draft behind the Chosen one; the Letter is Validated
    expect(itemList.find(({ posting }) => posting.reference === BETHUNE_REFERENCE)).toMatchObject({
      research: 'draft',
      letter: 'validated',
    });
    expect(itemList.find(({ posting }) => posting.reference === RENNES_REFERENCE)).toMatchObject({
      research: 'none',
      letter: 'none',
    });
  });

  it('refuses to list the To Apply Postings of an unknown Candidate', async () => {
    const { actions } = await detectPostings();

    await expect(actions.listToApply({ candidateId: 'nobody' })).rejects.toThrow(/nobody/);
  });
});
