import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Actions } from '#/actions/index.ts';

import { detectPostings } from './data-directory.ts';
import { createFakeAiSession } from './fake-ai-session.ts';

// The Béthune juvenile court Posting, detected from the responses recorded on 2026-10-29
const REFERENCE = '2026-2445600';

const REPORT_PDF = new Uint8Array(readFileSync(path.join(import.meta.dirname, 'fixtures/profile/cv.pdf')));

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

// A PDF is converted by the worker (ADR-0003), like a Version the Candidate brings: until then the document
// is listed but no run reads it
describe('adding a document as a PDF', () => {
  const REPORT = { reference: REFERENCE, title: 'Rapport d’activité', content: REPORT_PDF };

  it('lists it as converting, then reads it once the worker converted it', async () => {
    const aiSession = createFakeAiSession({ fileByName: { 'document.mdx': '# Rapport\n' } });
    const { actions } = await detectPostings(aiSession);

    await actions.addCustomArtifactPdf(REPORT);

    const { customArtifactList: runningList } = await actions.readPosting({ reference: REFERENCE });
    expect(runningList).toMatchObject([{ title: 'Rapport d’activité', state: 'running', text: '' }]);
    const before = await actions.readGeneration({ reference: REFERENCE, artifact: 'research' });
    expect(before.inputList.filter(({ kind }) => kind === 'custom_artifact')).toEqual([]);

    await actions.runQueuedJobs();

    const { customArtifactList } = await actions.readPosting({ reference: REFERENCE });
    expect(customArtifactList).toMatchObject([{ state: 'ready', text: '# Rapport\n' }]);
    expect(aiSession.headlessSessionList[0]?.fixedPrompt).toContain('brought.pdf');
    const after = await actions.readGeneration({ reference: REFERENCE, artifact: 'research' });
    expect(after.inputList.filter(({ kind }) => kind === 'custom_artifact')).toMatchObject([
      { title: 'Rapport d’activité', isChecked: true },
    ]);
  });

  it('shows a failed conversion, which no run reads', async () => {
    const { actions } = await detectPostings(createFakeAiSession({ fileByName: {} }));

    await actions.addCustomArtifactPdf(REPORT);
    await actions.runQueuedJobs();

    const { customArtifactList } = await actions.readPosting({ reference: REFERENCE });
    expect(customArtifactList).toMatchObject([{ state: 'failed', text: '' }]);
    const { inputList } = await actions.readGeneration({ reference: REFERENCE, artifact: 'research' });
    expect(inputList.filter(({ kind }) => kind === 'custom_artifact')).toEqual([]);
  });

  it('refuses a file that is not a PDF', async () => {
    const { actions } = await detectPostings();

    await expect(
      actions.addCustomArtifactPdf({ ...REPORT, content: new TextEncoder().encode('# Rapport\n') }),
    ).rejects.toMatchObject({ code: 'not_a_pdf' });
  });
});
