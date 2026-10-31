import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Actions } from '#/actions/index.ts';

import { detectPostings } from './data-directory.ts';

const PLACE = 'Tribunal judiciaire, Béthune';

const NOW = new Date('2026-11-10T12:00:00Z');

function setDay(day: string) {
  vi.setSystemTime(new Date(`${day}T09:00:00Z`));
}

afterAll(() => {
  vi.useRealTimers();
});

// The Applications in progress of the home, from one Detection on the responses recorded on 2026-10-29:
// each Posting below moves on a day of its own, then the list is read on 2026-11-10
describe('the Applications in progress', () => {
  let actions: Actions;

  async function changeStatusOn(day: string, reference: string, status: string) {
    vi.setSystemTime(new Date(`${day}T09:00:00Z`));
    await actions.changeStatus({ reference, status });
  }

  async function addInterview(reference: string, start: string) {
    await actions.addInterview({ reference, start, place: PLACE, interviewers: 'Mme Durand' });
  }

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    ({ actions } = await detectPostings());
    // An upcoming Interview, the furthest
    await changeStatusOn('2026-11-01', '2026-2445600', 'applied');
    await addInterview('2026-2445600', '2026-11-20T10:00');
    // An Interview past, then the nearest upcoming one
    await changeStatusOn('2026-11-02', '2026-2445609', 'applied');
    await addInterview('2026-2445609', '2026-11-05T10:00');
    await addInterview('2026-2445609', '2026-11-12T10:00');
    // Its only Interview past on 2026-11-08, after its Status last changed
    await changeStatusOn('2026-11-03', '2026-2445183', 'applied');
    await addInterview('2026-2445183', '2026-11-08T10:00');
    await changeStatusOn('2026-11-06', '2026-2360445', 'applied');
    await changeStatusOn('2026-11-07', '2026-2231960', 'applied');
    // Hired, Rejected and Archived ones are no longer in progress
    await changeStatusOn('2026-11-04', '2026-2360411', 'applied');
    await changeStatusOn('2026-11-09', '2026-2360411', 'hired');
    await changeStatusOn('2026-11-04', '2026-2350473', 'applied');
    await changeStatusOn('2026-11-09', '2026-2350473', 'rejected');
    await changeStatusOn('2026-11-04', '2026-2338409', 'applied');
    await actions.archive({ reference: '2026-2338409' });
    vi.setSystemTime(NOW);
  });

  async function listApplications() {
    return actions.listApplicationsInProgress({ candidateId: 'lea' });
  }

  async function findApplication(reference: string) {
    const applicationList = await listApplications();
    return applicationList.find(({ posting }) => posting.reference === reference);
  }

  it('come with an upcoming Interview first, the nearest first, then the most recently changed', async () => {
    const applicationList = await listApplications();

    expect(applicationList.map(({ posting }) => posting.reference)).toEqual([
      '2026-2445609',
      '2026-2445600',
      '2026-2445183',
      '2026-2231960',
      '2026-2360445',
    ]);
  });

  it('leave out the To Apply Postings and the Hired, Rejected and Archived Applications', async () => {
    const applicationList = await listApplications();
    const referenceList = applicationList.map(({ posting }) => posting.reference);

    expect(referenceList).not.toContain('2026-2360411');
    expect(referenceList).not.toContain('2026-2350473');
    expect(referenceList).not.toContain('2026-2338409');
    expect(referenceList).not.toContain('2026-2199164');
  });

  it('show the next Interview, how many there are and what the selector offers', async () => {
    expect(await findApplication('2026-2445609')).toMatchObject({
      posting: { step: 'invited', statusChangedAt: new Date('2026-11-02T09:00:00Z') },
      statusChoiceList: ['hired', 'rejected'],
      nextInterview: { number: 2, startAt: new Date('2026-11-12T09:00:00Z') },
      hasUpcomingInterview: true,
      interviewCount: 2,
    });
  });

  it('show the last Interview once none is upcoming, and none without any', async () => {
    expect(await findApplication('2026-2445183')).toMatchObject({
      posting: { step: 'interviewed' },
      nextInterview: { number: 1, startAt: new Date('2026-11-08T09:00:00Z') },
      hasUpcomingInterview: false,
      interviewCount: 1,
    });
    expect(await findApplication('2026-2360445')).toMatchObject({
      nextInterview: null,
      hasUpcomingInterview: false,
      interviewCount: 0,
    });
  });

  it('give the first lines of the Notes as plain text, empty without Notes', async () => {
    await actions.saveNotes({
      reference: '2026-2445600',
      notes: '# Appel du greffe\n\nRappeler **lundi** la directrice.\n\n- Apporter le CV\n- Relire le *rapport*\n',
    });

    expect(await findApplication('2026-2445600')).toMatchObject({
      notesExcerpt: 'Appel du greffe\nRappeler lundi la directrice.\nApporter le CV',
    });
    expect(await findApplication('2026-2360445')).toMatchObject({ notesExcerpt: '' });
  });

  it('cut long Notes at a word, with an ellipsis', async () => {
    const sentence = 'La directrice de greffe attend une réponse rapide sur la mobilité. ';
    await actions.saveNotes({ reference: '2026-2231960', notes: sentence.repeat(5) });

    const application = await findApplication('2026-2231960');

    expect(application?.notesExcerpt).toBe(
      'La directrice de greffe attend une réponse rapide sur la mobilité. La directrice de greffe attend une réponse rapide sur la mobilité. La directrice de greffe…',
    );
  });

  it('are refused for an unknown Candidate', async () => {
    await expect(actions.listApplicationsInProgress({ candidateId: 'nobody' })).rejects.toThrow(/nobody/);
  });
});

// Every Application of /applications by section, and the Postings archived without one, from one Detection on
// the responses recorded on 2026-10-29: each Posting below moves on a day of its own, then the sections are read
// on 2026-11-10
describe('the Applications by section', () => {
  let actions: Actions;

  async function changeStatusOn(day: string, reference: string, status: string) {
    setDay(day);
    await actions.changeStatus({ reference, status });
  }

  async function archiveOn(day: string, reference: string) {
    setDay(day);
    await actions.archive({ reference });
  }

  async function addInterview(reference: string, start: string) {
    await actions.addInterview({ reference, start, place: PLACE, interviewers: 'Mme Durand' });
  }

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    ({ actions } = await detectPostings());
    // In progress: an upcoming Interview does not put an Application first here
    await changeStatusOn('2026-11-01', '2026-2445600', 'applied');
    await addInterview('2026-2445600', '2026-11-20T10:00');
    await changeStatusOn('2026-11-02', '2026-2445609', 'applied');
    // Hired
    await changeStatusOn('2026-11-01', '2026-2445183', 'applied');
    await changeStatusOn('2026-11-03', '2026-2445183', 'hired');
    await changeStatusOn('2026-11-01', '2026-2360445', 'applied');
    await changeStatusOn('2026-11-05', '2026-2360445', 'hired');
    // Rejected: its Interview past on 2026-11-08 is its last change
    await changeStatusOn('2026-11-01', '2026-2231960', 'applied');
    await addInterview('2026-2231960', '2026-11-08T10:00');
    await changeStatusOn('2026-11-04', '2026-2231960', 'rejected');
    await changeStatusOn('2026-11-01', '2026-2360411', 'applied');
    await changeStatusOn('2026-11-06', '2026-2360411', 'rejected');
    // Archived, whatever their outcome
    await changeStatusOn('2026-11-01', '2026-2350473', 'applied');
    await archiveOn('2026-11-07', '2026-2350473');
    await changeStatusOn('2026-11-01', '2026-2338409', 'applied');
    await changeStatusOn('2026-11-02', '2026-2338409', 'hired');
    await archiveOn('2026-11-03', '2026-2338409');
    // Archived without an Application
    await archiveOn('2026-11-05', '2026-2199164');
    await archiveOn('2026-11-06', '2026-2445637');
    vi.setSystemTime(NOW);
  });

  async function listSections() {
    return actions.listApplications({ candidateId: 'lea' });
  }

  it('come in order, each with the most recently changed first, and leave out the To Apply Postings', async () => {
    const sectionList = await listSections();

    expect(
      sectionList.map(({ section, applicationList }) => [
        section,
        applicationList.map(({ posting }) => posting.reference),
      ]),
    ).toEqual([
      ['in_progress', ['2026-2445609', '2026-2445600']],
      ['hired', ['2026-2360445', '2026-2445183']],
      ['rejected', ['2026-2231960', '2026-2360411']],
      ['archived', ['2026-2350473', '2026-2338409']],
      ['archived_without_application', ['2026-2445637', '2026-2199164']],
    ]);
  });

  it('give the rows of the home, a Posting without an Application offering only Applied', async () => {
    const sectionList = await listSections();
    const rowList = sectionList.flatMap(({ applicationList }) => applicationList);

    expect(rowList.find(({ posting }) => posting.reference === '2026-2445600')).toMatchObject({
      posting: { step: 'invited' },
      statusChoiceList: ['hired', 'rejected'],
      nextInterview: { number: 1 },
      hasUpcomingInterview: true,
      interviewCount: 1,
    });
    expect(rowList.find(({ posting }) => posting.reference === '2026-2199164')).toMatchObject({
      posting: { status: 'to_apply' },
      statusChoiceList: ['applied'],
      nextInterview: null,
    });
  });

  it('are refused for an unknown Candidate', async () => {
    await expect(actions.listApplications({ candidateId: 'nobody' })).rejects.toThrow(/nobody/);
  });
});
