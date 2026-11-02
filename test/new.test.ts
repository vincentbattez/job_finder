import { describe, expect, it } from 'vitest';

import { createActions } from '#/actions/index.ts';

import { createDataDirectory, detectPostings } from './data-directory.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

// The two Béthune Postings, published after a first Detection on the responses recorded on 2026-10-29
const FOUND_REFERENCE_LIST = ['2026-2445600', '2026-2445609'];
const KEPT_REFERENCE = '2026-2420931';
const DISMISSED_REFERENCE = '2026-2290529';

// New: what the Candidate sorts, the Postings the last Detection found first (ADR-0018)
describe('New list', () => {
  it('lists the New Postings still followed, those the last Detection found flagged', async () => {
    const dataDirectory = createDataDirectory();
    const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout(FOUND_REFERENCE_LIST) } });
    const earlierActions = await createActions({ dataDirectory, fetch: earlierFetch.fetch });
    await earlierActions.detect();
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await actions.detect();
    await actions.keep({ reference: KEPT_REFERENCE });
    await actions.archive({ reference: DISMISSED_REFERENCE });

    const itemList = await actions.listNew({ candidateId: 'lea' });

    const referenceList = itemList.map(({ posting }) => posting.reference);
    expect(referenceList).toHaveLength(79);
    expect(referenceList).not.toContain(KEPT_REFERENCE);
    expect(referenceList).not.toContain(DISMISSED_REFERENCE);
    expect(itemList.filter(({ isFound }) => isFound).map(({ posting }) => posting.reference)).toEqual(
      expect.arrayContaining(FOUND_REFERENCE_LIST),
    );
    expect(itemList.filter(({ isFound }) => isFound)).toHaveLength(FOUND_REFERENCE_LIST.length);
  });

  // The Postings already online at the first launch are only imported: none was just found
  it('flags none after the first launch', async () => {
    const { actions } = await detectPostings();

    const itemList = await actions.listNew({ candidateId: 'lea' });

    expect(itemList).toHaveLength(81);
    expect(itemList.filter(({ isFound }) => isFound)).toEqual([]);
  });

  // Dismissing archives a New Posting, which stays New (ADR-0018): the Archived filter finds it there
  it('lists the dismissed New Postings apart, under Archived, and the unarchived one back among the followed', async () => {
    const { actions } = await detectPostings();
    await actions.keep({ reference: KEPT_REFERENCE });
    await actions.archive({ reference: KEPT_REFERENCE });
    await actions.archive({ reference: DISMISSED_REFERENCE });

    const archivedList = await actions.listNew({ candidateId: 'lea', isArchived: true });
    await actions.unarchive({ reference: DISMISSED_REFERENCE });

    expect(archivedList.map(({ posting }) => posting.reference)).toEqual([DISMISSED_REFERENCE]);
    expect(await actions.listNew({ candidateId: 'lea', isArchived: true })).toEqual([]);
    const followedList = await actions.listNew({ candidateId: 'lea' });
    expect(followedList.map(({ posting }) => posting.reference)).toContain(DISMISSED_REFERENCE);
  });

  it('refuses to list the New Postings of an unknown Candidate', async () => {
    const { actions } = await detectPostings();

    await expect(actions.listNew({ candidateId: 'nobody' })).rejects.toThrow(/nobody/);
  });
});
