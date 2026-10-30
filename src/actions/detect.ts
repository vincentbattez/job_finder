import type { z } from 'zod/v4';

import {
  DETECTION_SCHEMA,
  type Detection,
  type ListedPosting,
  type Posting,
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

interface INotifiedPosting {
  posting: Posting;
  notification: NotificationComposer;
}

// What a Detection found for one Watch, and the notifications to send once every Watch is done
interface IFoundPostings {
  detection: Omit<z.input<typeof DETECTION_SCHEMA>, 'notificationFailureList'>;
  notificationList: INotifiedPosting[];
}

// What the Detection of one Watch knows while it reads the Postings of its Source
interface IWatchRun {
  watch: Watch;
  // A first launch cut off goes on at the next Detection, still triggering nothing
  isFirstLaunch: boolean;
  // Every Posting of its Candidate, those this Detection saves included: a Repost is found there
  postingList: Posting[];
}

// The Detection, in the actions rather than a module: it reads the Source modules, which no module
// may import (ADR-0003). It knows them only through their family (ADR-0010).
export function createDetectActions({ workspace, sourceList, findSource, findLocale, locate, notify }: ActionContext) {
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
    { watch: { candidateId, source }, isFirstLaunch, postingList }: IWatchRun,
    listedPosting: ListedPosting,
    { jobDescription, isInZone }: ISourceReadResult,
  ): Promise<{ posting: Posting; notification: NotificationComposer | undefined }> {
    const repostOf = findRepostedPosting({ ...listedPosting, ...jobDescription }, postingList);
    const location = await locate(readCity(jobDescription.workplace));
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
  async function detectWatch(watch: Watch): Promise<IFoundPostings> {
    const { candidateId, source } = watch;
    const outOfZonePostingList = await workspace.listOutOfZonePostingsSince(watch);
    const locale = await findLocale(candidateId);
    const sourceModule = findSource(source, locale, watch.id);
    const { matchingList, nearMissList } = await sourceModule.search(watch, locale);
    const run = {
      watch,
      isFirstLaunch: watch.detectedAt === null,
      postingList: await workspace.listPostings(candidateId),
    };
    const newPostingList: Posting[] = [];
    const notificationList: INotifiedPosting[] = [];
    // Oldest first, as published: a Repost found by the same Detection as the Posting it
    // publishes again, as on the first launch, is saved after it
    const oldestFirstList = matchingList.toSorted((left, right) => left.reference.localeCompare(right.reference));
    for (const listedPosting of oldestFirstList) {
      const isSame = (posting: Posting) => posting.source === source && posting.reference === listedPosting.reference;
      const outOfZonePosting = outOfZonePostingList.find((posting) => isSame(posting));
      if (outOfZonePosting === undefined && run.postingList.some((posting) => isSame(posting))) {
        continue;
      }
      const readResult = await sourceModule.readJobDescription(listedPosting.reference, watch, locale);
      if (outOfZonePosting === undefined) {
        const { posting, notification } = await saveNewPosting(run, listedPosting, readResult);
        newPostingList.push(posting);
        notificationList.push(...(notification === undefined ? [] : [{ posting, notification }]));
      } else if (readResult.isInZone) {
        const notification = await enterZone(run, outOfZonePosting);
        notificationList.push(...(notification === undefined ? [] : [{ posting: outOfZonePosting, notification }]));
      }
    }
    await workspace.setDetected(watch);
    return {
      detection: { watchId: watch.id, candidateId, isFirstLaunch: run.isFirstLaunch, newPostingList, nearMissList },
      notificationList,
    };
  }

  return {
    // The form of a Watch asks for the Parameters of the Source it follows
    listSources(): Promise<SourceModule[]> {
      return Promise.resolve(sourceList.map(({ description }) => description));
    },

    async detect(): Promise<Detection[]> {
      // The Postings saved before they had a city, or whose city API Géo did not know
      const unlocatedPostingList = await workspace.listUnlocatedPostings();
      for (const posting of unlocatedPostingList) {
        await workspace.setLocation(posting, await locate(posting.city ?? readCity(posting.workplace)));
      }
      const watchList = await workspace.listWatches();
      const foundList: IFoundPostings[] = [];
      for (const watch of watchList) {
        foundList.push(await detectWatch(watch));
      }
      // Notified last, once every Posting is saved and its Research queued. A notification not sent
      // undoes nothing: it comes back with what the Detection found, which jf detect prints first.
      const detectionList: Detection[] = [];
      for (const { detection, notificationList } of foundList) {
        const failureList = await Promise.all(
          notificationList.map(({ posting, notification }) => notify(posting, notification)),
        );
        const notificationFailureList = failureList.filter((failure) => failure !== undefined);
        detectionList.push(DETECTION_SCHEMA.parse({ ...detection, notificationFailureList }));
      }
      return detectionList;
    },
  };
}
