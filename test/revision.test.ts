import { beforeAll, describe, expect, it } from 'vitest';

import type { Actions } from '#/actions/index.ts';
import { sortRevision } from '#/actions/revision-sections.ts';

import { applyTo } from './apply.ts';
import { detectPostings } from './data-directory.ts';

// The sections of a first Chosen Interview Brief, then of a newer one that renamed its second section
const FIRST_TITLE_LIST = ['Le poste', 'Questions probables', 'Tes atouts'];
const NEWER_TITLE_LIST = ['Le poste', 'Questions attendues', 'Tes atouts', 'Après l’entretien'];

// Each test works on its own Posting, so they share one Detection on the responses recorded on 2026-10-29
describe('the Revision of an Interview', () => {
  let actions: Actions;

  beforeAll(async () => {
    ({ actions } = await detectPostings());
  });

  async function prepareInterview(reference: string): Promise<{ reference: string; number: number }> {
    await applyTo(actions, reference);
    const { number } = await actions.addInterview({
      reference,
      start: '2030-11-19T14:00',
      place: 'Tribunal judiciaire, Béthune',
      interviewers: '',
    });
    return { reference, number };
  }

  it('starts with no note and nothing Mastered', async () => {
    const interview = await prepareInterview('2026-2445609');

    expect(await actions.readRevision(interview)).toEqual([]);
  });

  it('keeps a note and a Mastered mark per section title, the last written winning', async () => {
    const interview = await prepareInterview('2026-2448209');

    await actions.writeRevisionNote({ ...interview, title: 'Questions probables', note: 'Parler du stage.' });
    await actions.writeRevisionNote({ ...interview, title: 'Questions probables', note: 'Parler du stage au TJ.' });
    await actions.markMastered({ ...interview, title: 'Questions probables', isMastered: 'true' });
    await actions.markMastered({ ...interview, title: 'Le poste', isMastered: true });
    await actions.markMastered({ ...interview, title: 'Le poste', isMastered: 'false' });

    expect(await actions.readRevision(interview)).toEqual([
      { title: 'Questions probables', note: 'Parler du stage au TJ.', isMastered: true },
      { title: 'Le poste', note: '', isMastered: false },
    ]);
  });

  it('refuses a section without a title', async () => {
    const interview = await prepareInterview('2026-2445183');

    await expect(actions.writeRevisionNote({ ...interview, title: '  ', note: 'Rien.' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });

  it('is deleted with its Interview, so a later Interview given the same number starts afresh', async () => {
    const interview = await prepareInterview('2026-2412620');
    await actions.writeRevisionNote({ ...interview, title: 'Le poste', note: 'Relire la fiche.' });

    await actions.deleteInterview(interview);
    const later = await actions.addInterview({ ...interview, start: '2030-12-01T09:00', place: '', interviewers: '' });

    expect(later.number).toBe(interview.number);
    expect(await actions.readRevision(interview)).toEqual([]);
  });
});

describe('the sections of a Revision', () => {
  const NOTED_LIST = [
    { title: 'Questions probables', note: 'Parler du stage.', isMastered: true },
    { title: 'Le poste', note: 'Greffe des mineurs.', isMastered: false },
    { title: 'Tes atouts', note: '', isMastered: true },
  ];

  it('follow the sections of the Chosen Version, in its order, an unwritten one empty', () => {
    expect(sortRevision(FIRST_TITLE_LIST, NOTED_LIST)).toEqual({
      sectionList: [
        { title: 'Le poste', note: 'Greffe des mineurs.', isMastered: false },
        { title: 'Questions probables', note: 'Parler du stage.', isMastered: true },
        { title: 'Tes atouts', note: '', isMastered: true },
      ],
      vanishedList: [],
    });
  });

  it('carry over to a newer Chosen Version wherever the title remains, the others kept apart as vanished', () => {
    expect(sortRevision(NEWER_TITLE_LIST, NOTED_LIST)).toEqual({
      sectionList: [
        { title: 'Le poste', note: 'Greffe des mineurs.', isMastered: false },
        { title: 'Questions attendues', note: '', isMastered: false },
        { title: 'Tes atouts', note: '', isMastered: true },
        { title: 'Après l’entretien', note: '', isMastered: false },
      ],
      vanishedList: [{ title: 'Questions probables', note: 'Parler du stage.', isMastered: true }],
    });
  });

  it('leave out of the vanished sections those that kept neither a note nor a Mastered mark', () => {
    const clearedList = [{ title: 'Questions probables', note: ' ', isMastered: false }];

    expect(sortRevision(NEWER_TITLE_LIST, clearedList).vanishedList).toEqual([]);
  });
});
