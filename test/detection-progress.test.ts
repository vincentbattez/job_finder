import { execFile } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { createActions, type Actions } from '#/actions/index.ts';

import { createDataDirectory } from './data-directory.ts';
import { LEA_WATCH_ID } from './lea.ts';
import { createRecordedFetch, DSJ_FEED_URL, feedWithout } from './recorded-http.ts';

// What test/detect-in-process.ts prints: what its Detection found, or the refusal of the lock
const REFUSED_MESSAGE_PATTERN = /^Une Détection est déjà en cours/;
const FOUND_SCHEMA = z.object({ newReferenceList: z.array(z.string()) });
const REFUSED_SCHEMA = z.object({
  code: z.literal('detection_running'),
  message: z.string().regex(REFUSED_MESSAGE_PATTERN),
});
const DETECT_OUTCOME_SCHEMA = z.union([FOUND_SCHEMA, REFUSED_SCHEMA]);

// A Detection in a process of its own (test/detect-in-process.ts): SQLite makes two connections of
// one process wait on each other, which two processes never do
async function detectInProcess(dataDirectory: string): Promise<unknown> {
  const scriptPath = path.join(import.meta.dirname, 'detect-in-process.ts');
  const { stdout } = await promisify(execFile)(process.execPath, [scriptPath, dataDirectory]);
  return JSON.parse(stdout);
}

// Expired depends on the day: the clock stays on the day the responses were recorded
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});

describe('the last Detection', () => {
  it('is never run on a new database', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: createRecordedFetch().fetch });

    expect(await actions.followDetection({ candidateId: 'lea' })).toEqual({
      running: null,
      last: null,
      newReferenceList: [],
    });
  });

  it('keeps when it ran, how it was started and what it found on each Watch, named by its label', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: createRecordedFetch().fetch });

    await actions.detect({ origin: 'automation' });

    const { running, last } = await actions.followDetection({ candidateId: 'lea' });
    expect(running).toBeNull();
    expect(last).toMatchObject({
      origin: 'automation',
      startedAt: new Date('2026-10-29T12:00:00Z'),
      finishedAt: new Date('2026-10-29T12:00:00Z'),
      error: null,
      watchList: [
        {
          watchId: LEA_WATCH_ID,
          label: 'attaché de justice',
          step: 'done',
          isFirstLaunch: true,
          listedCount: 81,
          readCount: 81,
          readTotal: 81,
          notificationFailureList: [],
        },
      ],
    });
    expect(last?.watchList[0]?.newPostingList).toHaveLength(81);
    expect(last?.watchList[0]?.nearMissList).toHaveLength(4);
  });

  it('tells a second Detection that found nothing, with the Postings the Source listed', async () => {
    const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: createRecordedFetch().fetch });
    await actions.detect();

    await actions.detect();

    const { last } = await actions.followDetection({ candidateId: 'lea' });
    expect(last).toMatchObject({
      origin: 'cli',
      watchList: [{ isFirstLaunch: false, listedCount: 81, readCount: 0, readTotal: 0, newPostingList: [] }],
    });
  });

  it('keeps a failure, its message and the step it stopped at', async () => {
    const recordedFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: '', status: 500 } });
    const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: recordedFetch.fetch });

    await expect(actions.detect()).rejects.toThrow(/HTTP 500/);

    const { running, last } = await actions.followDetection({ candidateId: 'lea' });
    expect(running).toBeNull();
    expect(last?.error).toMatch(/HTTP 500/);
    expect(last?.watchList).toMatchObject([{ step: 'searching', readCount: 0 }]);
  });
});

// The detail page of 2026-2199164, the fourth reference oldest first
const HELD_URL = 'https://place-ep-recrute.talent-soft.com/offre-de-emploi/emploi_2199164.aspx';

// The recorded responses, the detail page of HELD_URL held back until released: the Detection stops
// there, mid-reading, for as long as a test looks at it
function createHeldFetch() {
  const recordedFetch = createRecordedFetch();
  const gate = new EventTarget();
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if ((input instanceof Request ? input.url : input.toString()) === HELD_URL) {
      await once(gate, 'release');
    }
    return recordedFetch.fetch(input, init);
  };
  return {
    fetch,
    release: () => {
      gate.dispatchEvent(new Event('release'));
    },
  };
}

// Once the Detection reads HELD_URL, three Job Descriptions are read
async function waitForHeld(actions: Actions): Promise<void> {
  await vi.waitFor(async () => {
    const { running } = await actions.followDetection({ candidateId: 'lea' });
    expect(running?.watchList[0]?.readCount).toBe(3);
  });
}

describe('a running Detection', () => {
  it('shows its step and how many Job Descriptions it read, out of how many', async () => {
    const heldFetch = createHeldFetch();
    const actions = await createActions({ dataDirectory: createDataDirectory(), fetch: heldFetch.fetch });

    const started = await actions.startDetection({ candidateId: 'lea' });
    await waitForHeld(actions);

    expect(started).toMatchObject({ origin: 'button', finishedAt: null });
    const { running } = await actions.followDetection({ candidateId: 'lea' });
    expect(running).toMatchObject({
      origin: 'button',
      finishedAt: null,
      watchList: [{ label: 'attaché de justice', step: 'reading', listedCount: 81, readCount: 3, readTotal: 81 }],
    });
    heldFetch.release();
  });

  it('refuses a second Detection, whoever starts it, until it is over', async () => {
    const dataDirectory = createDataDirectory();
    const heldFetch = createHeldFetch();
    const actions = await createActions({ dataDirectory, fetch: heldFetch.fetch });
    const cliActions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    const detection = actions.detect({ origin: 'automation' });
    await waitForHeld(actions);

    await expect(cliActions.detect()).rejects.toThrow(/Une Détection est déjà en cours/);
    await expect(cliActions.startDetection({ candidateId: 'lea' })).rejects.toThrow(/déjà en cours/);

    heldFetch.release();
    await detection;
    await cliActions.detect();
    const { last } = await cliActions.followDetection({ candidateId: 'lea' });
    expect(last).toMatchObject({ origin: 'cli' });
  });

  // The daily automation and the button at the same instant, each in its own process: the lock
  // refuses one with its code (ADR-0014), so the same new Posting is never saved twice
  it('lets one of two Detections launched at the same instant run, with no duplicate Posting', async () => {
    const dataDirectory = createDataDirectory();
    const bethuneReferenceList = ['2026-2445600', '2026-2445609'];
    const earlierFetch = createRecordedFetch({ [DSJ_FEED_URL]: { body: feedWithout(bethuneReferenceList) } });
    const earlierActions = await createActions({ dataDirectory, fetch: earlierFetch.fetch });
    await earlierActions.detect();

    const resultList = await Promise.all([detectInProcess(dataDirectory), detectInProcess(dataDirectory)]);

    // Refused while the other runs, or run after it and finding nothing new: never another failure
    const outcomeList = resultList.map((result) => DETECT_OUTCOME_SCHEMA.parse(result));
    expect(outcomeList.flatMap((outcome) => ('newReferenceList' in outcome ? outcome.newReferenceList : []))).toEqual(
      bethuneReferenceList,
    );
    const actions = await createActions({ dataDirectory });
    const postingList = await actions.listPostings({ candidateId: 'lea' });
    const referenceList = postingList.map(({ reference }) => reference);
    expect(referenceList).toHaveLength(81);
    expect(new Set(referenceList).size).toBe(81);
  });

  it('stops holding the lock once its process died, and says it was interrupted', async () => {
    const dataDirectory = createDataDirectory();
    const deadActions = await createActions({ dataDirectory, fetch: createHeldFetch().fetch });
    // Never released, as a process that died mid-reading
    void deadActions.startDetection({ candidateId: 'lea' });
    await waitForHeld(deadActions);
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    vi.setSystemTime(new Date('2026-10-29T12:11:00Z'));

    await actions.detect();

    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    const { running, last } = await actions.followDetection({ candidateId: 'lea' });
    expect(running).toBeNull();
    expect(last).toMatchObject({ error: null, startedAt: new Date('2026-10-29T12:11:00Z') });
  });
});

it('stops showing as running once its process died, without waiting for the next Detection', async () => {
  const dataDirectory = createDataDirectory();
  const deadActions = await createActions({ dataDirectory, fetch: createHeldFetch().fetch });
  // Never released, as a process that died mid-reading
  void deadActions.startDetection({ candidateId: 'lea' });
  await waitForHeld(deadActions);
  const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
  vi.setSystemTime(new Date('2026-10-29T12:11:00Z'));

  const { running, last } = await actions.followDetection({ candidateId: 'lea' });

  vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
  expect(running).toBeNull();
  expect(last?.error).toMatch(/Interrompue/);
  expect(last?.watchList).toMatchObject([{ step: 'reading', readCount: 3 }]);
});

describe('the scope of a Detection', () => {
  it('covers only the Watches of the Candidate the button is pressed for', async () => {
    const dataDirectory = createDataDirectory();
    const actions = await createActions({ dataDirectory, fetch: createRecordedFetch().fetch });
    await actions.createCandidate({ id: 'emma', name: 'Emma' });
    // The recorded responses hold only the attaché de justice Postings
    await actions.saveWatch({
      candidateId: 'emma',
      source: 'pep',
      parameters: { title: 'attaché de justice' },
    });

    await actions.startDetection({ candidateId: 'emma' });
    await vi.waitFor(async () => {
      const { running } = await actions.followDetection({ candidateId: 'emma' });
      expect(running).toBeNull();
    });

    const { last } = await actions.followDetection({ candidateId: 'emma' });
    expect(last?.watchList).toMatchObject([{ watchId: 'emma-1', step: 'done' }]);
    expect(await actions.followDetection({ candidateId: 'lea' })).toEqual({
      running: null,
      last: null,
      newReferenceList: [],
    });
    expect(await actions.listPostings({ candidateId: 'lea' })).toEqual([]);
  });
});
