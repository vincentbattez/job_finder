import { z } from 'zod/v4';

import { defaultErrorTranslator } from '#/domain/catalogue/i18n.ts';
import { codedError, codedErrorOf, type CodedError } from '#/domain/coded-error.ts';
import {
  DETECTION_ORIGIN_SCHEMA,
  DETECTION_OVERVIEW_SCHEMA,
  DETECTION_SCHEMA,
  type Detection,
  type DetectionOrigin,
  type DetectionOverview,
  type ListedPosting,
  type Locale,
  type Location,
  type Posting,
  type RecordedDetection,
  type SourceModule,
  type Watch,
} from '#/domain/index.ts';
import { readCity } from '#/geo/city.ts';
import { composeDetectionSummary, type ISummarizedPosting, type ISummarizedWatch } from '#/notification/index.ts';
import { findRepostedPosting } from '#/repost/index.ts';
import type { ISourceReadResult } from '#/source/index.ts';
import { hasBeenApplied } from '#/status/index.ts';

import type { ActionContext } from './context.ts';
import { createTolerantLocator } from './locator.ts';

// Every Watch, started from jf detect unless the daily automation says so
const DETECT_INPUT_SCHEMA = z.object({ origin: DETECTION_ORIGIN_SCHEMA.default('cli') });

// A Detection touches its row at each step and each Job Description it reads: one untouched for this
// long lost its process, and no longer keeps the next one from running (ADR-0014)
const STALE_AFTER_MS = 10 * 60 * 1000;

// A Detection left running by a process that died is failed once stale: in the default locale, as no
// Candidate stands behind it
function staleOption() {
  return {
    staleBefore: new Date(Date.now() - STALE_AFTER_MS),
    interruptedError: defaultErrorTranslator()('detectionInterrupted'),
  };
}

// What a Posting a Detection found keeps of it: its reference and its title
const referenceAndTitle = ({ reference, title }: { reference: string; title: string }) => ({ reference, title });

// A Detection once claimed, with the Watches it covers
interface IClaimedDetection {
  detection: RecordedDetection;
  watchList: Watch[];
}

// What a Detection found for one Watch, and the Postings its Detection Summary tells once every Watch is done
interface IFoundPostings {
  watch: Watch;
  detection: Omit<z.input<typeof DETECTION_SCHEMA>, 'notificationFailureList' | 'locationFailure'>;
  summarizedList: ISummarizedPosting[];
}

// What the Detection Summary shows of one Watch
interface IWatchSummary {
  watch: Watch;
  summarizedList: ISummarizedPosting[];
  nearMissList: ISummarizedWatch['nearMissList'];
}

const watchSummaryOf = ({ watch, summarizedList, detection: { nearMissList } }: IFoundPostings): IWatchSummary => ({
  watch,
  summarizedList,
  nearMissList,
});

// What the Detection of one Watch knows while it reads the Postings of its Source
interface IWatchRun {
  detection: RecordedDetection;
  watch: Watch;
  // A first launch cut off goes on at the next Detection, still triggering nothing
  isFirstLaunch: boolean;
  // Every Posting of its Candidate, those this Detection saves included: a Repost is found there
  postingList: Posting[];
  locale: Locale;
  locate: (city: string | null, locale: Locale) => Promise<Location>;
}

// The Detection, in the actions rather than a module: it reads the Source modules, which no module
// may import (ADR-0003). It knows them only through their family (ADR-0010).
export function createDetectActions({
  workspace,
  sourceList,
  findCandidate,
  findSource,
  findLocale,
  locate,
  notifyCandidate,
}: ActionContext) {
  function descriptionOf({ source }: Watch): SourceModule | undefined {
    return sourceList.find(({ description: { id } }) => id === source)?.description;
  }

  function sourceNameOf(watch: Watch): string {
    return descriptionOf(watch)?.name ?? watch.source;
  }

  // What the Candidate reads to tell a Watch apart: its first text Parameter, such as the searched
  // title, in the order its Source declares them, never its identifier (#63)
  function labelOf(watch: Watch): string {
    const { source, parameters } = watch;
    const description = descriptionOf(watch);
    const label = description?.parameterList
      .map(({ name }) => parameters[name])
      .find((value): value is string => typeof value === 'string' && value !== '');
    return label ?? description?.name ?? source;
  }

  // In the Zone, a Posting gets its Research (ADR-0003)
  async function startInZone(posting: Posting, repostOf: Posting | undefined): Promise<ISummarizedPosting> {
    await workspace.createJob(posting, 'research', { isAutomatic: true });
    return {
      posting,
      repost: repostOf === undefined ? null : { repostedReference: repostOf.reference, isApplied: false },
    };
  }

  // The Postings already online at the first launch start nothing (ADR-0003). The Repost of an
  // Posting once Applied gets no Research whatever the Zone: the Candidate, who applied already, decides.
  async function saveNewPosting(
    { watch: { candidateId, source }, isFirstLaunch, postingList, locale, locate: locateCity }: IWatchRun,
    listedPosting: ListedPosting,
    { jobDescription, isInZone }: ISourceReadResult,
  ): Promise<{ posting: Posting; summarized: ISummarizedPosting | undefined }> {
    const repostOf = findRepostedPosting({ ...listedPosting, ...jobDescription }, postingList);
    const location = await locateCity(readCity(jobDescription.workplace), locale);
    const posting = await workspace.savePosting({
      candidateId,
      source,
      listedPosting,
      jobDescription,
      isInZone,
      repostOf,
      location,
    });
    postingList.push(posting);
    if (isFirstLaunch) {
      return { posting, summarized: undefined };
    }
    if (repostOf !== undefined && hasBeenApplied(repostOf)) {
      return { posting, summarized: { posting, repost: { repostedReference: repostOf.reference, isApplied: true } } };
    }
    return { posting, summarized: isInZone ? await startInZone(posting, repostOf) : undefined };
  }

  // A Posting another Watch of the Candidate stored out of its Zone, found in the Zone of this one: it
  // starts what it would have started in the Zone, unless it was online at the first launch of this
  // Watch. A Repost of a Posting once Applied was told when it was stored.
  async function enterZone({ isFirstLaunch, postingList }: IWatchRun, posting: Posting) {
    const inZonePosting = await workspace.setInZone(posting);
    const repostOf = postingList.find(({ reference }) => reference === posting.repostOf?.reference);
    if (isFirstLaunch || (repostOf !== undefined && hasBeenApplied(repostOf))) {
      return;
    }
    return startInZone(inZonePosting, repostOf);
  }

  // A stored Posting of the Watch's Source is Unpublished while the Source no longer lists it, whatever
  // the title the Watch searches for; one the Source lists again is no longer (ADR-0001)
  async function markUnpublished({ watch, postingList }: IWatchRun, publishedReferenceList: string[]) {
    const now = new Date();
    for (const posting of postingList) {
      const isUnpublished = !publishedReferenceList.includes(posting.reference);
      if (posting.source === watch.source && isUnpublished !== (posting.unpublishedAt !== null)) {
        await workspace.setUnpublishedAt(posting, isUnpublished ? now : null);
      }
    }
  }

  // A Posting is known by its reference, never by its publication date, which the site changes
  // (ADR-0001). Each Watch has its own Zone: a Posting stored out of the Zone of one is read again
  // by each other Watch that has not read it yet.
  // Each Posting to tell goes into summarizedList as soon as it is saved, so that a Detection cut off
  // still tells it
  async function detectWatch(
    detection: RecordedDetection,
    watch: Watch,
    locateCity: IWatchRun['locate'],
    summarizedList: ISummarizedPosting[],
  ): Promise<IFoundPostings> {
    const { candidateId, source } = watch;
    await workspace.updateDetectionWatch(detection, watch.id, { step: 'searching' });
    const outOfZonePostingList = await workspace.listOutOfZonePostingsSince(watch);
    const locale = await findLocale(candidateId);
    const sourceModule = findSource(source, locale, watch.id);
    const { matchingList, nearMissList, publishedReferenceList } = await sourceModule.search(watch, locale);
    const run = {
      detection,
      watch,
      isFirstLaunch: watch.detectedAt === null,
      postingList: await workspace.listPostings(candidateId),
      locale,
      locate: locateCity,
    };
    await markUnpublished(run, publishedReferenceList);
    const newPostingList: Posting[] = [];
    // Oldest first, as published: a Repost found by the same Detection as the Posting it
    // publishes again, as on the first launch, is saved after it
    const oldestFirstList = matchingList.toSorted((left, right) => left.reference.localeCompare(right.reference));
    const isSame = (posting: Posting, { reference }: ListedPosting) =>
      posting.source === source && posting.reference === reference;
    // Counted before reading, so the front shows how many Job Descriptions are left
    const toReadList = oldestFirstList.filter(
      (listedPosting) =>
        outOfZonePostingList.some((posting) => isSame(posting, listedPosting)) ||
        run.postingList.every((posting) => !isSame(posting, listedPosting)),
    );
    await workspace.updateDetectionWatch(detection, watch.id, {
      step: 'reading',
      listedCount: matchingList.length,
      readTotal: toReadList.length,
      nearMissList: nearMissList.map((posting) => referenceAndTitle(posting)),
    });
    for (const [index, listedPosting] of toReadList.entries()) {
      const outOfZonePosting = outOfZonePostingList.find((posting) => isSame(posting, listedPosting));
      const readResult = await sourceModule.readJobDescription(listedPosting.reference, watch, locale);
      if (outOfZonePosting === undefined) {
        const { posting, summarized } = await saveNewPosting(run, listedPosting, readResult);
        newPostingList.push(posting);
        summarizedList.push(...(summarized === undefined ? [] : [summarized]));
      } else if (readResult.isInZone) {
        const summarized = await enterZone(run, outOfZonePosting);
        summarizedList.push(...(summarized === undefined ? [] : [summarized]));
      }
      await workspace.updateDetectionWatch(detection, watch.id, {
        readCount: index + 1,
        newPostingList: newPostingList.map((posting) => referenceAndTitle(posting)),
      });
    }
    await workspace.setDetected(watch);
    return {
      watch,
      detection: { watchId: watch.id, candidateId, isFirstLaunch: run.isFirstLaunch, newPostingList, nearMissList },
      summarizedList,
    };
  }

  // Recorded before it runs, with each Watch it covers: the lock against a second Detection (ADR-0014)
  async function claimDetection(origin: DetectionOrigin, candidateId: string | null): Promise<IClaimedDetection> {
    const watchList = await workspace.listWatches(candidateId ?? undefined);
    const claimed = await workspace.claimDetection(
      {
        origin,
        candidateId,
        watchList: watchList.map((watch) => ({
          watchId: watch.id,
          candidateId: watch.candidateId,
          label: labelOf(watch),
          isFirstLaunch: watch.detectedAt === null,
        })),
      },
      staleOption(),
    );
    if ('runningSince' in claimed) {
      throw codedError('detection_running', { startedAt: claimed.runningSince });
    }
    return { detection: claimed.detection, watchList };
  }

  // A failure is recorded on the Detection, which the front shows, then stops the run
  async function runDetection({ detection, watchList }: IClaimedDetection): Promise<Detection[]> {
    try {
      const detectionList = await detectWatches(detection, watchList);
      await workspace.finishDetection(detection, null);
      return detectionList;
    } catch (error) {
      await workspace.finishDetection(detection, codedErrorOf(error).message);
      throw error;
    }
  }

  async function runInBackground(claimed: IClaimedDetection): Promise<void> {
    try {
      await runDetection(claimed);
    } catch {
      // Recorded on the Detection, whose failure the front shows
    }
  }

  // One Detection Summary per Candidate with Postings to tell, covering each of their Watches; the
  // failure of one comes back for their Watches
  async function sendSummaries(
    { startedAt, origin }: RecordedDetection,
    watchSummaryList: IWatchSummary[],
  ): Promise<Map<string, CodedError>> {
    const failureByCandidate = new Map<string, CodedError>();
    const candidateIdList = [...new Set(watchSummaryList.map(({ watch }) => watch.candidateId))];
    for (const candidateId of candidateIdList) {
      const candidateWatchSummaryList = watchSummaryList.filter(({ watch }) => watch.candidateId === candidateId);
      const postingList = candidateWatchSummaryList.flatMap(({ summarizedList }) => summarizedList);
      if (postingList.length === 0) {
        continue;
      }
      const watchList = candidateWatchSummaryList.map(({ watch, summarizedList, nearMissList }) => ({
        label: labelOf(watch),
        sourceName: sourceNameOf(watch),
        postingCount: summarizedList.length,
        nearMissList,
      }));
      const failure = await notifyCandidate(
        candidateId,
        composeDetectionSummary({ startedAt, origin, postingList, watchList }),
      );
      if (failure !== undefined) {
        failureByCandidate.set(candidateId, failure);
      }
    }
    return failureByCandidate;
  }

  async function detectWatches(detection: RecordedDetection, watchList: Watch[]): Promise<Detection[]> {
    const locator = createTolerantLocator(locate);
    // The Postings saved before they had a city, or whose city API Géo did not know
    const unlocatedPostingList = await workspace.listUnlocatedPostings();
    for (const posting of unlocatedPostingList) {
      const locale = await findLocale(posting.candidateId);
      await workspace.setLocation(posting, await locator.locate(posting.city ?? readCity(posting.workplace), locale));
    }
    const foundList: IFoundPostings[] = [];
    for (const watch of watchList) {
      const summarizedList: ISummarizedPosting[] = [];
      try {
        foundList.push(await detectWatch(detection, watch, locator.locate, summarizedList));
      } catch (error) {
        // The Postings saved before the cut are known from now on: the next Detection would never
        // tell them, so they are told before the failure stops the run
        await sendSummaries(detection, [
          ...foundList.map((found) => watchSummaryOf(found)),
          { watch, summarizedList, nearMissList: [] },
        ]);
        throw error;
      }
    }
    // Told last, once every Posting is saved and its Research queued. A Detection Summary not sent
    // undoes nothing: it comes back with what the Detection found, which jf detect prints first.
    for (const { detection: found } of foundList) {
      await workspace.updateDetectionWatch(detection, found.watchId, { step: 'notifying' });
    }
    const failureByCandidate = await sendSummaries(
      detection,
      foundList.map((found) => watchSummaryOf(found)),
    );
    const detectionList: Detection[] = [];
    for (const { detection: found, summarizedList } of foundList) {
      // Only a Watch whose Postings the Detection Summary told carries its failure
      const failure = summarizedList.length === 0 ? undefined : failureByCandidate.get(found.candidateId);
      const notificationFailureList = failure === undefined ? [] : [failure.message];
      const locationFailure = locator.failureFor(await findLocale(found.candidateId));
      const watchDetection = DETECTION_SCHEMA.parse({ ...found, notificationFailureList, locationFailure });
      detectionList.push(watchDetection);
      await workspace.updateDetectionWatch(detection, found.watchId, {
        step: 'done',
        notificationFailureList,
        locationFailure,
      });
    }
    return detectionList;
  }

  return {
    // The form of a Watch asks for the Parameters of the Source it follows
    listSources(): Promise<SourceModule[]> {
      return Promise.resolve(sourceList.map(({ description }) => description));
    },

    async detect(rawInput?: unknown): Promise<Detection[]> {
      const { origin } = DETECT_INPUT_SCHEMA.parse(rawInput ?? {});
      return runDetection(await claimDetection(origin, null));
    },

    // The front's button covers the Watches of the page's Candidate only (#63). The Detection runs on
    // in this process, and the front follows it through followDetection.
    async startDetection(rawInput: unknown): Promise<RecordedDetection> {
      const candidate = await findCandidate(rawInput);
      const claimed = await claimDetection('button', candidate.id);
      void runInBackground(claimed);
      return claimed.detection;
    },

    // The running Detection, whoever started it, unless its process died, and the last one that
    // covered the Candidate's Watches. The Postings it found are New until the next one; those of a
    // first launch, already online, are only imported.
    async followDetection(rawInput: unknown): Promise<DetectionOverview> {
      const candidate = await findCandidate(rawInput);
      await workspace.failStaleDetections(staleOption());
      const { running, last } = await workspace.findDetections(candidate.id);
      const newReferenceList = (last?.watchList ?? [])
        .filter(({ isFirstLaunch }) => !isFirstLaunch)
        .flatMap(({ newPostingList }) => newPostingList.map(({ reference }) => reference));
      return DETECTION_OVERVIEW_SCHEMA.parse({ running, last, newReferenceList });
    },
  };
}
