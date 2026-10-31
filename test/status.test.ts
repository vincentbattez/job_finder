import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory, createMigratedDataDirectory } from './data-directory.ts';
import { LEA_WATCH } from './lea.ts';
import { createRecordedFetch } from './recorded-http.ts';

// The Default Deadline Period set as from the front, before the Detection
async function detectWithDefaultDelay(months: number): Promise<Actions> {
  const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: createRecordedFetch().fetch });
  await actions.saveDefaultDeadlinePeriod({ months });
  await actions.detect();
  return actions;
}

async function findPosting(actions: Actions, reference: string) {
  const postingList = await actions.listPostings({ candidateId: 'lea' });
  return postingList.find((posting) => posting.reference === reference);
}

// Expired depends on the day: the clock stays on the day the responses were recorded
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});

// Each test changes the status of its own Postings, so they share one Detection
describe('status of a Posting', () => {
  let actions: Actions;

  beforeAll(async () => {
    actions = await detectWithDefaultDelay(6);
  });

  async function findStatus(reference: string) {
    const posting = await findPosting(actions, reference);
    return posting?.status;
  }

  it('marks a Posting as Applied, though it has no Letter', async () => {
    await actions.changeStatus({ reference: '2026-2445600', status: 'applied' });

    expect(await findStatus('2026-2445600')).toBe('applied');
  });

  it('marks as Applied the Boulogne Postings the Candidate applied to before the tool, though Expired', async () => {
    await actions.changeStatus({ reference: '2026-2231960', status: 'applied' });
    await actions.changeStatus({ reference: '2026-2338409', status: 'applied' });

    expect([await findPosting(actions, '2026-2231960'), await findPosting(actions, '2026-2338409')]).toMatchObject([
      { status: 'applied', isExpired: true },
      { status: 'applied', isExpired: true },
    ]);
  });

  // Archived is a mark beside the Status, never a Status (ADR-0007)
  it('archives a To Apply Posting, which keeps its Status', async () => {
    await actions.archive({ reference: '2026-2445609' });

    expect(await findPosting(actions, '2026-2445609')).toMatchObject({
      status: 'to_apply',
      archivedAt: new Date('2026-10-29T12:00:00Z'),
    });
  });

  it('archives an Applied Posting, whose Chosen Letter stays the one sent', async () => {
    await actions.changeStatus({ reference: '2026-2445183', status: 'applied' });

    await actions.archive({ reference: '2026-2445183' });

    expect(await findPosting(actions, '2026-2445183')).toMatchObject({
      status: 'applied',
      appliedAt: new Date('2026-10-29T12:00:00Z'),
      archivedAt: new Date('2026-10-29T12:00:00Z'),
    });
    await expect(actions.runModule({ module: 'letter', reference: '2026-2445183' })).rejects.toThrow(
      /L'Offre 2026-2445183 a été Postulée : sa Lettre retenue est figée/,
    );
  });

  // Unarchiving only removes the mark: the Posting is found exactly where it was
  it('unarchives an Applied Posting without moving its Status nor its appliedAt', async () => {
    await actions.changeStatus({ reference: '2026-2350473', status: 'applied' });
    await actions.archive({ reference: '2026-2350473' });

    await actions.unarchive({ reference: '2026-2350473' });

    expect(await findPosting(actions, '2026-2350473')).toMatchObject({
      status: 'applied',
      appliedAt: new Date('2026-10-29T12:00:00Z'),
      archivedAt: null,
    });
  });

  it('unarchives a Posting never Applied, which stays To Apply', async () => {
    await actions.archive({ reference: '2026-2199164' });

    await actions.unarchive({ reference: '2026-2199164' });

    expect(await findPosting(actions, '2026-2199164')).toMatchObject({ status: 'to_apply', archivedAt: null });
  });

  // Archiving again keeps the day it was first archived, which sorts the Archived
  it('archives an Archived Posting again without moving its archiving date', async () => {
    await actions.archive({ reference: '2026-2445637' });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));

    await actions.archive({ reference: '2026-2445637' });

    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    expect(await findPosting(actions, '2026-2445637')).toMatchObject({
      archivedAt: new Date('2026-10-29T12:00:00Z'),
    });
  });

  // Applied is never undone: the Chosen Letter was sent
  it('never brings an Applied Posting back to To Apply, Archived or not', async () => {
    await actions.changeStatus({ reference: '2026-2360411', status: 'applied' });
    await actions.archive({ reference: '2026-2360411' });

    await expect(actions.changeStatus({ reference: '2026-2360411', status: 'to_apply' })).rejects.toThrow(
      /L'Offre 2026-2360411 a été Postulée : elle ne revient jamais À traiter/,
    );
    expect(await findStatus('2026-2360411')).toBe('applied');
  });

  // The outcome selector offers each of them, and none other; archiving changes none of them
  it('gives the Status choices of each Posting, Archived or not', async () => {
    await actions.changeStatus({ reference: '2026-2445629', status: 'applied' });
    await actions.archive({ reference: '2026-2445671' });

    const detailList = await Promise.all(
      ['2026-2445584', '2026-2445629', '2026-2445671'].map((reference) => actions.readPosting({ reference })),
    );

    expect(detailList.map(({ statusChoiceList }) => statusChoiceList)).toEqual([
      ['applied'],
      ['hired', 'rejected'],
      ['applied'],
    ]);
  });

  // An employer sometimes answers without inviting; a wrong click is put back In progress
  it('marks an Application Hired, then Rejected, then back In progress, each change dated', async () => {
    await actions.changeStatus({ reference: '2026-2448056', status: 'applied' });
    vi.setSystemTime(new Date('2026-10-30T09:00:00Z'));
    await actions.changeStatus({ reference: '2026-2448056', status: 'hired' });
    const hired = await findPosting(actions, '2026-2448056');
    vi.setSystemTime(new Date('2026-10-30T10:00:00Z'));
    await actions.changeStatus({ reference: '2026-2448056', status: 'rejected' });
    const rejected = await findPosting(actions, '2026-2448056');
    vi.setSystemTime(new Date('2026-10-30T11:00:00Z'));

    await actions.changeStatus({ reference: '2026-2448056', status: 'applied' });

    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    expect([hired, rejected, await findPosting(actions, '2026-2448056')]).toMatchObject([
      { status: 'hired', statusChangedAt: new Date('2026-10-30T09:00:00Z') },
      { status: 'rejected', statusChangedAt: new Date('2026-10-30T10:00:00Z') },
      { status: 'applied', statusChangedAt: new Date('2026-10-30T11:00:00Z') },
    ]);
  });

  // The Application keeps the day it started: its Chosen Letter was sent that day
  it('keeps when it was Applied once Hired, its Letter staying frozen', async () => {
    await actions.changeStatus({ reference: '2026-2448209', status: 'applied' });
    vi.setSystemTime(new Date('2026-10-30T09:00:00Z'));

    await actions.changeStatus({ reference: '2026-2448209', status: 'hired' });

    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    expect(await findPosting(actions, '2026-2448209')).toMatchObject({
      status: 'hired',
      appliedAt: new Date('2026-10-29T12:00:00Z'),
    });
    await expect(actions.runModule({ module: 'letter', reference: '2026-2448209' })).rejects.toThrow(
      /a été Postulée : sa Lettre retenue est figée/,
    );
  });

  it('refuses an outcome to a To Apply Posting, whose Application has not started', async () => {
    await expect(actions.changeStatus({ reference: '2026-2448213', status: 'hired' })).rejects.toThrow(
      "L'Offre 2026-2448213 est À traiter : elle ne peut passer qu'en Postulée.",
    );
    expect(await findPosting(actions, '2026-2448213')).toMatchObject({ status: 'to_apply', statusChangedAt: null });
  });

  it('never brings a Rejected Application back to To Apply', async () => {
    await actions.changeStatus({ reference: '2026-2448215', status: 'applied' });
    await actions.changeStatus({ reference: '2026-2448215', status: 'rejected' });

    await expect(actions.changeStatus({ reference: '2026-2448215', status: 'to_apply' })).rejects.toMatchObject({
      code: 'status_change_after_applied',
    });
    expect(await findStatus('2026-2448215')).toBe('rejected');
  });

  it('refuses to archive an unknown Posting', async () => {
    await expect(actions.archive({ reference: '2026-0000000' })).rejects.toThrow(/Offre inconnue : 2026-0000000/);
  });

  // Its Status did not change, nor does the day of its last change
  it('marks an Applied Posting as Applied again without complaint', async () => {
    await actions.changeStatus({ reference: '2026-2360445', status: 'applied' });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));

    await actions.changeStatus({ reference: '2026-2360445', status: 'applied' });

    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    expect(await findPosting(actions, '2026-2360445')).toMatchObject({
      status: 'applied',
      statusChangedAt: new Date('2026-10-29T12:00:00Z'),
    });
  });

  it('refuses an unknown Posting', async () => {
    await expect(actions.changeStatus({ reference: '2026-0000000', status: 'applied' })).rejects.toThrow(
      /Offre inconnue : 2026-0000000/,
    );
  });
});

it('refuses a reference shared by the Postings of two Candidates', async () => {
  const actions = await createActions({
    dataDirectory: createMigratedDataDirectory(),
    fetch: createRecordedFetch().fetch,
  });
  for (const candidateId of ['lea', 'camille']) {
    await actions.createCandidate({ id: candidateId, name: candidateId });
    await actions.saveWatch({ candidateId, ...LEA_WATCH });
  }
  await actions.detect();

  await expect(actions.changeStatus({ reference: '2026-2445600', status: 'applied' })).rejects.toThrow(
    /Plusieurs Offres ont la référence 2026-2445600, chez des Candidats différents : .*Veille/,
  );
  const posting = await findPosting(actions, '2026-2445600');
  expect(posting?.status).toBe('to_apply');
});

describe('Expired', () => {
  it('flags the Postings whose Deadline is over', async () => {
    const actions = await detectWithDefaultDelay(6);

    expect([await findPosting(actions, '2026-2231960'), await findPosting(actions, '2026-2445600')]).toMatchObject([
      { deadline: new Date('2026-04-23'), isExpired: true },
      { deadline: new Date('2026-11-20'), isExpired: false },
    ]);
  });

  // 2026-2412620 has no Deadline and was published on 2026-09-24
  it('flags a Posting without a Deadline once its publication plus the Default Deadline Period is over', async () => {
    const postingList = [
      await findPosting(await detectWithDefaultDelay(6), '2026-2412620'),
      await findPosting(await detectWithDefaultDelay(1), '2026-2412620'),
    ];

    expect(postingList).toMatchObject([
      { deadline: null, isExpired: false },
      { deadline: null, isExpired: true },
    ]);
  });

  it('follows the Default Deadline Period set from the front at once, and at the next launch', async () => {
    const dataDirectory = createDataDirectory();
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await actions.detect();

    await actions.saveDefaultDeadlinePeriod({ months: '1' });

    expect(await actions.readDefaultDeadlinePeriod()).toEqual({ months: 1 });
    expect(await findPosting(actions, '2026-2412620')).toMatchObject({ isExpired: true });
    expect(await findPosting(await createActions({ dataDirectory }), '2026-2412620')).toMatchObject({
      isExpired: true,
    });
  });

  it('refuses a Default Deadline Period that is not a whole number of months', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory() });

    await expect(actions.saveDefaultDeadlinePeriod({ months: '0' })).rejects.toThrow(
      'Le Délai par défaut est un nombre entier de mois, au moins 1.',
    );
    expect(await actions.readDefaultDeadlinePeriod()).toEqual({ months: 6 });
  });
});
