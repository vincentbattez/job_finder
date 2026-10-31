import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { createRecordedFetch } from './recorded-http.ts';

// Imported as from the front, its reference made from its file
async function importJobDescription(actions: Actions, city: string): Promise<string> {
  const job = await actions.importJobDescription({
    candidateId: 'lea',
    fileName: `greffier-${city}.md`,
    markdown: `# Greffier placé – Tribunal judiciaire de ${city}\n`,
  });
  return job.posting.reference;
}

afterAll(() => {
  vi.useRealTimers();
});

// The latest Postings of the home: those that just arrived, through a Detection or an import
describe('latest Postings', () => {
  let actions: Actions;
  let earlierImportedReference: string;
  let importedReference: string;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    actions = await createActions({ dataDirectory: createDataDirectory(), fetch: createRecordedFetch().fetch });
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    earlierImportedReference = await importJobDescription(actions, 'Arras');
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    await actions.detect();
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    importedReference = await importJobDescription(actions, 'Lille');
  });

  async function listLatestReferences() {
    const postingList = await actions.listLatestPostings({ candidateId: 'lea' });
    return postingList.map(({ reference }) => reference);
  }

  it('shows the 6 latest To Apply Postings of the Zone, the latest arrived first, an imported one included', async () => {
    const latestReferenceList = await listLatestReferences();

    // Within one Detection, the last Posting it saved comes first
    expect(latestReferenceList).toEqual([
      importedReference,
      '2026-2445609',
      '2026-2445600',
      '2026-2445183',
      '2026-2360445',
      '2026-2360411',
    ]);
    // Imported before the Detection, it arrived before the 9 Postings of the Zone it found
    expect(latestReferenceList).not.toContain(earlierImportedReference);
  });

  it('leaves out an Archived Posting and an Applied one, the next latest taking their place', async () => {
    await actions.archive({ reference: '2026-2445609' });
    await actions.changeStatus({ reference: '2026-2445600', status: 'applied' });

    expect(await listLatestReferences()).toEqual([
      importedReference,
      '2026-2445183',
      '2026-2360445',
      '2026-2360411',
      '2026-2350473',
      '2026-2338409',
    ]);
  });

  it('never shows a Posting detected out of the Zone, though fewer than 6 are left', async () => {
    const leftInZoneList = [
      '2026-2445183',
      '2026-2360445',
      '2026-2360411',
      '2026-2350473',
      '2026-2338409',
      '2026-2231960',
      '2026-2199164',
    ];
    for (const reference of leftInZoneList) {
      await actions.archive({ reference });
    }

    expect(await listLatestReferences()).toEqual([importedReference, earlierImportedReference]);
  });

  it('refuses to list the latest Postings of an unknown Candidate', async () => {
    await expect(actions.listLatestPostings({ candidateId: 'nobody' })).rejects.toThrow(/nobody/);
  });
});
