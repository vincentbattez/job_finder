import { beforeAll, describe, expect, it } from 'vitest';

import type { Actions } from '#/actions/index.ts';

import { detectPostings } from './data-directory.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

// Each test adds to its own Posting or names its own Annex, so they share one Detection
describe('adding a document', () => {
  let actions: Actions;

  beforeAll(async () => {
    ({ actions } = await detectPostings());
  });

  it('lists a Custom Artifact in the Posting’s Documents, as the Candidate wrote it', async () => {
    const custom = await actions.addCustomArtifact({
      reference: REFERENCE,
      title: 'Appel avec la greffière',
      text: 'Elle cherche une personne rigoureuse.',
    });

    const { customArtifactList } = await actions.readPosting({ reference: REFERENCE });

    expect(customArtifactList).toMatchObject([
      {
        key: custom.key,
        title: 'Appel avec la greffière',
        interviewNumber: null,
        text: 'Elle cherche une personne rigoureuse.',
      },
    ]);
  });

  it('refuses a Custom Artifact without a text', async () => {
    await expect(
      actions.addCustomArtifact({ reference: '2026-2445609', title: 'Vide', text: '  ' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('puts an Annex into the Profile, named after its title, which a run reading the Profile may add', async () => {
    const annex = await actions.addAnnex({ candidateId: 'lea', title: 'Mémoire de M2', markdown: '# Mémoire\n' });

    expect(annex.fileName).toBe('annex-memoire-de-m2.md');
    const { inputList } = await actions.readGeneration({ reference: REFERENCE, artifact: 'letter' });
    expect(inputList.find(({ key }) => key === 'profile:annex-memoire-de-m2.md')).toMatchObject({
      mode: 'optional',
      isChecked: false,
      content: '# Mémoire\n',
    });
  });

  it('refuses an Annex of a name the Profile already has', async () => {
    await actions.addAnnex({ candidateId: 'lea', title: 'Relevé de notes', markdown: 'Licence.' });

    await expect(
      actions.addAnnex({ candidateId: 'lea', title: 'Relevé de notes', markdown: 'Master.' }),
    ).rejects.toMatchObject({ code: 'duplicate_profile_file' });
  });
});
