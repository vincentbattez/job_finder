import { z } from 'zod/v4';

import { defaultErrorTranslator, tFor } from '#/domain/catalogue/i18n.ts';
import { codedError, codedErrorOf, formatError } from '#/domain/coded-error.ts';
import {
  DETECTION_ORIGIN_SCHEMA,
  DETECTION_OVERVIEW_SCHEMA,
  DETECTION_SCHEMA,
  LOCATION_SCHEMA,
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
import {
  composeNewPostingNotification,
  composeRepostAppliedNotification,
  composeRepostNotification,
  type NotificationComposer,
} from '#/notification/index.ts';
import { findRepostedPosting } from '#/repost/index.ts';
import type { ISourceReadResult } from '#/source/index.ts';
import { hasBeenApplied } from '#/status/index.ts';

import type { ActionContext } from './context.ts';

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

// The failures of API Géo, a secondary service whose outage leaves the Postings off the map
const API_GEO_FAILURE_SET = new Set<string>(['api_geo_unreachable', 'api_geo_status', 'api_geo_format_changed']);

// What a Posting a Detection found keeps of it: its reference and its title
const referenceAndTitle = ({ reference, title }: { reference: string; title: string }) => ({ reference, title });

// A Detection once claimed, with the Watches it covers
interface IClaimedDetection {
  detection: RecordedDetection;
  watchList: Watch[];
}

interface INotifiedPosting {
  posting: Posting;
  notification: NotificationComposer;
}

// What a Detection found for one Watch, and the notifications to send once every Watch is done
interface IFoundPostings {
  detection: Omit<z.input<typeof DETECTION_SCHEMA>, 'notificationFailureList' | 'locationFailure'>;
  notificationList: INotifiedPosting[];
}

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
  notify,
}: ActionContext) {
  // What the Candidate reads to tell a Watch apart: its first text Parameter, such as the searched
  // title, in the order its Source declares them, never its identifier (#63)
  function labelOf({ source, parameters }: Watch): string {
    const description = sourceList.find(({ description: { id } }) => id === source)?.description;
    const label = description?.parameterList
      .map(({ name }) => parameters[name])
      .find((value): value is string => typeof value === 'string' && value !== '');
    return label ?? description?.name ?? source;
  }

  // In the Zone, a Posting gets its Research (ADR-0003)
  async function startInZone(posting: Posting, repostOf: Posting | undefined): Promise<NotificationComposer> {
    await workspace.createJob(posting, 'research');
    return repostOf === undefined
      ? composeNewPostingNotification(posting)
      : composeRepostNotification(posting, repostOf);
  }

  // The Postings already online at the first launch start nothing (ADR-0003). The Repost of an
  // Posting once Applied gets no Research whatever the Zone: the Candidate, who applied already, decides.
  async function saveNewPosting(
    { watch: { candidateId, source }, isFirstLaunch, postingList, locale, locate: locateCity }: IWatchRun,
    listedPosting: ListedPosting,
    { jobDescription, isInZone }: ISourceReadResult,
  ): Promise<{ posting: Posting; notification: NotificationComposer | undefined }> {
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
      return { posting, notification: undefined };
    }
    if (repostOf !== undefined && hasBeenApplied(repostOf)) {
      return { posting, notification: composeRepostAppliedNotification(posting, repostOf) };
    }
    return { posting, notification: isInZone ? await startInZone(posting, repostOf) : undefined };
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

  // A Posting is known by its reference, never by its publication date, which the site changes
  // (ADR-0001). Each Watch has its own Zone: a Posting stored out of the Zone of one is read again
  // by each other Watch that has not read it yet.
  async function detectWatch(
    detection: RecordedDetection,
    watch: Watch,
    locateCity: IWatchRun['locate'],
  ): Promise<IFoundPostings> {
    const { candidateId, source } = watch;
    await workspace.updateDetectionWatch(detection, watch.id, { step: 'searching' });
    const outOfZonePostingList = await workspace.listOutOfZonePostingsSince(watch);
    const locale = await findLocale(candidateId);
    const sourceModule = findSource(source, locale, watch.id);
    const { matchingList, nearMissList } = await sourceModule.search(watch, locale);
    const run = {
      detection,
      watch,
      isFirstLaunch: watch.detectedAt === null,
      postingList: await workspace.listPostings(candidateId),
      locale,
      locate: locateCity,
    };
    const newPostingList: Posting[] = [];
    const notificationList: INotifiedPosting[] = [];
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
        const { posting, notification } = await saveNewPosting(run, listedPosting, readResult);
        newPostingList.push(posting);
        notificationList.push(...(notification === undefined ? [] : [{ posting, notification }]));
      } else if (readResult.isInZone) {
        const notification = await enterZone(run, outOfZonePosting);
        notificationList.push(...(notification === undefined ? [] : [{ posting: outOfZonePosting, notification }]));
      }
      await workspace.updateDetectionWatch(detection, watch.id, {
        readCount: index + 1,
        newPostingList: newPostingList.map((posting) => referenceAndTitle(posting)),
      });
    }
    await workspace.setDetected(watch);
    return {
      detection: { watchId: watch.id, candidateId, isFirstLaunch: run.isFirstLaunch, newPostingList, nearMissList },
      notificationList,
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

  // API Géo only places a Posting on the map: down, it leaves the Postings without coordinates, which
  // the next Detection locates (listUnlocatedPostings), and is asked no more for this Detection
  function createDetectionLocator() {
    let outage: unknown;
    return {
      locate: async (city: string | null, locale: Locale): Promise<Location> => {
        if (outage === undefined) {
          try {
            return await locate(city, locale);
          } catch (error) {
            if (!API_GEO_FAILURE_SET.has(codedErrorOf(error).code)) {
              throw error;
            }
            outage = error;
          }
        }
        return LOCATION_SCHEMA.parse({ city, region: null, latitude: null, longitude: null });
      },
      // What each Watch reports of the outage, with its code, in its Candidate's locale
      failureFor: (locale: Locale): string | null => {
        return outage === undefined
          ? null
          : tFor(locale, 'error')('postingsNotLocated', { reason: formatError(outage) });
      },
    };
  }

  async function detectWatches(detection: RecordedDetection, watchList: Watch[]): Promise<Detection[]> {
    const locator = createDetectionLocator();
    // The Postings saved before they had a city, or whose city API Géo did not know
    const unlocatedPostingList = await workspace.listUnlocatedPostings();
    for (const posting of unlocatedPostingList) {
      const locale = await findLocale(posting.candidateId);
      await workspace.setLocation(posting, await locator.locate(posting.city ?? readCity(posting.workplace), locale));
    }
    const foundList: IFoundPostings[] = [];
    for (const watch of watchList) {
      foundList.push(await detectWatch(detection, watch, locator.locate));
    }
    // Notified last, once every Posting is saved and its Research queued. A notification not sent
    // undoes nothing: it comes back with what the Detection found, which jf detect prints first.
    const detectionList: Detection[] = [];
    for (const { detection: found, notificationList } of foundList) {
      await workspace.updateDetectionWatch(detection, found.watchId, { step: 'notifying' });
      const failureList = await Promise.all(
        notificationList.map(({ posting, notification }) => notify(posting, notification)),
      );
      const notificationFailureList = failureList.filter((failure) => failure !== undefined);
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
