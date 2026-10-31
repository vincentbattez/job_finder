import { beforeAll, describe, expect, it } from 'vitest';

import type { Actions } from '#/actions/index.ts';

import { detectPostings } from './data-directory.ts';

const PLACE = 'Tribunal judiciaire, Béthune';

const INTERVIEWERS = 'Mme Durand, directrice de greffe';

// Each test works on its own Posting, so they share one Detection on the responses recorded on 2026-10-29
describe('the Interviews of an Application', () => {
  let actions: Actions;

  beforeAll(async () => {
    ({ actions } = await detectPostings());
  });

  async function apply(reference: string): Promise<void> {
    await actions.changeStatus({ reference, status: 'applied' });
  }

  async function addInterview(reference: string, start: string, other: Record<string, unknown> = {}) {
    await actions.addInterview({ reference, start, place: PLACE, interviewers: INTERVIEWERS, ...other });
  }

  async function readStep(reference: string): Promise<string> {
    const { posting } = await actions.readPosting({ reference });
    return posting.step;
  }

  it('are refused on a To Apply Posting, which has no Application yet', async () => {
    await expect(addInterview('2026-2445600', '2030-11-19T14:00')).rejects.toMatchObject({
      code: 'interview_without_application',
    });
    expect(await actions.listInterviews({ reference: '2026-2445600' })).toEqual([]);
  });

  // An Interview proves the Letter was sent: Applied is only undone without one
  it('keep their Application from going back to To Apply', async () => {
    await apply('2026-2448209');
    await addInterview('2026-2448209', '2030-11-19T14:00');

    await expect(actions.changeStatus({ reference: '2026-2448209', status: 'to_apply' })).rejects.toThrow(
      "L'Offre 2026-2448209 a un Entretien : sa Lettre a été envoyée, elle ne revient pas À traiter.",
    );
    expect(await readStep('2026-2448209')).toBe('invited');
  });

  it('start at the time typed in Paris, last an hour by default and are numbered per Posting', async () => {
    await apply('2026-2445609');
    await addInterview('2026-2445609', '2026-11-19T14:00');
    await addInterview('2026-2445609', '2026-07-10T10:00', { durationMinutes: 90 });

    expect(await actions.listInterviews({ reference: '2026-2445609' })).toEqual([
      expect.objectContaining({
        number: 2,
        startAt: new Date('2026-07-10T08:00:00Z'),
        durationMinutes: 90,
        place: PLACE,
        interviewers: INTERVIEWERS,
      }),
      expect.objectContaining({ number: 1, startAt: new Date('2026-11-19T13:00:00Z'), durationMinutes: 60 }),
    ]);
  });

  it('are numbered from 1 on each Posting', async () => {
    await apply('2026-2445183');
    await addInterview('2026-2445183', '2030-01-10T09:00');

    expect(await actions.listInterviews({ reference: '2026-2445183' })).toEqual([
      expect.objectContaining({ number: 1 }),
    ]);
  });

  it('show on the Posting page, which tells whether the Posting has an Application', async () => {
    const toApply = await actions.readPosting({ reference: '2026-2412620' });
    await apply('2026-2412620');
    await addInterview('2026-2412620', '2030-01-10T09:00');

    const applied = await actions.readPosting({ reference: '2026-2412620' });

    expect([toApply.hasApplication, applied.hasApplication]).toEqual([false, true]);
    expect(applied.interviewList).toEqual([expect.objectContaining({ number: 1, place: PLACE })]);
  });

  it('keep what the Candidate edits, the time typed in Paris', async () => {
    await apply('2026-2350473');
    await addInterview('2026-2350473', '2030-01-10T09:00');

    await actions.editInterview({
      reference: '2026-2350473',
      number: '1',
      start: '2030-01-11T15:30',
      durationMinutes: '45',
      place: 'Visioconférence',
      interviewers: 'Le président du tribunal',
    });

    expect(await actions.listInterviews({ reference: '2026-2350473' })).toEqual([
      expect.objectContaining({
        number: 1,
        startAt: new Date('2030-01-11T14:30:00Z'),
        durationMinutes: 45,
        place: 'Visioconférence',
        interviewers: 'Le président du tribunal',
        editCount: 1,
      }),
    ]);
  });

  it('keep the fields an edit leaves out', async () => {
    await apply('2026-2360411');
    await addInterview('2026-2360411', '2030-01-10T09:00', { durationMinutes: 120 });

    await actions.editInterview({ reference: '2026-2360411', number: 1, place: 'Visioconférence' });

    expect(await actions.listInterviews({ reference: '2026-2360411' })).toEqual([
      expect.objectContaining({
        startAt: new Date('2030-01-10T08:00:00Z'),
        durationMinutes: 120,
        place: 'Visioconférence',
        interviewers: INTERVIEWERS,
      }),
    ]);
  });

  it('are deleted one by one, the others keeping their number', async () => {
    await apply('2026-2231960');
    await addInterview('2026-2231960', '2030-01-10T09:00');
    await addInterview('2026-2231960', '2030-01-17T09:00');

    await actions.deleteInterview({ reference: '2026-2231960', number: 1 });

    expect(await actions.listInterviews({ reference: '2026-2231960' })).toEqual([
      expect.objectContaining({ number: 2, startAt: new Date('2030-01-17T08:00:00Z') }),
    ]);
  });

  it.each([
    { name: 'edit', call: (actions: Actions) => actions.editInterview({ reference: '2026-2199164', number: 3 }) },
    { name: 'deletion', call: (actions: Actions) => actions.deleteInterview({ reference: '2026-2199164', number: 3 }) },
  ])('refuse the $name of an Interview the Posting does not have', async ({ call }) => {
    await apply('2026-2199164');

    await expect(call(actions)).rejects.toMatchObject({ code: 'unknown_interview' });
  });

  it('refuse a start that is not a date and a time', async () => {
    await apply('2026-2448056');

    await expect(addInterview('2026-2448056', 'jeudi 14h')).rejects.toMatchObject({ code: 'invalid_input' });
  });

  // Invited and Interviewed are computed on read, never stored (ADR-0009)
  it('make an Application Invited while one is to come, then Interviewed once all have taken place', async () => {
    await apply('2026-2360445');
    expect(await readStep('2026-2360445')).toBe('applied');

    await addInterview('2026-2360445', '2026-01-10T09:00');
    expect(await readStep('2026-2360445')).toBe('interviewed');

    await addInterview('2026-2360445', '2099-01-10T09:00');
    expect(await readStep('2026-2360445')).toBe('invited');

    const postingList = await actions.listPostings({ candidateId: 'lea' });
    expect(postingList.find(({ reference }) => reference === '2026-2360445')?.step).toBe('invited');
  });

  it('leave its outcome to a Hired Application', async () => {
    await apply('2026-2338409');
    await addInterview('2026-2338409', '2099-01-10T09:00');

    await actions.changeStatus({ reference: '2026-2338409', status: 'hired' });

    expect(await readStep('2026-2338409')).toBe('hired');
  });
});
