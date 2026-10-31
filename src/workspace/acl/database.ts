import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { z } from 'zod/v4';

import { localeOf } from '#/domain/catalogue/i18n.ts';
import type { ErrorCode } from '#/domain/error.ts';
import {
  CANDIDATE_SCHEMA,
  DEFAULT_DEADLINE_PERIOD_SCHEMA,
  JOB_SCHEMA,
  POSTING_SCHEMA,
  PROFILE_JOB_SCHEMA,
  QUEUED_JOB_SCHEMA,
  RECORDED_DETECTION_SCHEMA,
  SAVED_NOTIFICATION_CHANNEL_SCHEMA,
  VERSION_SCHEMA,
  WATCH_SCHEMA,
  type Artifact,
  type Candidate,
  type DefaultDeadlinePeriod,
  type DetectionOrigin,
  type DetectionWatch,
  type Job,
  type JobDescription,
  type ListedPosting,
  type Locale,
  type Location,
  type Module,
  type Parameters,
  type Posting,
  type ProfileJob,
  type QueuedJob,
  type RecordedDetection,
  type SavedNotificationChannel,
  type Status,
  type UploadFileName,
  type Version,
  type Watch,
} from '#/domain/index.ts';
import { findAppliedAt, isExpired } from '#/status/index.ts';
import { PrismaClient } from '#/workspace/generated/client.ts';

import type { Config } from './config.ts';

const ROOT_DIRECTORY = path.join(import.meta.dirname, '..', '..', '..');
const PRISMA_CLI_PATH = fileURLToPath(import.meta.resolve('prisma/build/index.js'));
const MIGRATIONS_DIRECTORY = path.join(ROOT_DIRECTORY, 'prisma', 'migrations');
const APPLIED_MIGRATION_LIST_SCHEMA = z.array(z.object({ migration_name: z.string() }));

const VERSION_INCLUDE = {
  inputList: { select: { artifact: true, number: true, posting: { select: { reference: true } } } },
};
const LINKED_POSTING_SELECT = { select: { reference: true } };
const POSTING_INCLUDE = {
  repostOf: LINKED_POSTING_SELECT,
  repostList: { ...LINKED_POSTING_SELECT, orderBy: { reference: 'asc' } },
} as const;
// The single row of the Default Deadline Period every Candidate shares
const DEFAULT_DEADLINE_PERIOD_ID = 1;
// The Default Deadline Period of a new database, that of the example config of older versions
const DEFAULT_DELAY_MONTHS = 6;

const DETECTION_INCLUDE = { watchList: { orderBy: { id: 'asc' } } } as const;

const MIGRATION_TIMEOUT_MS = 2 * 60_000;

// The single row of the worker's heartbeat
const WORKER_HEARTBEAT_ID = 1;

const JOB_INCLUDE = { posting: { include: POSTING_INCLUDE }, version: { include: VERSION_INCLUDE } };

export interface INewCandidate {
  id: string;
  name: string;
  locale: Locale;
}

// What a Detection copies of a Watch when it is claimed; the rest it records as it goes
type DetectionWatchCopy = 'watchId' | 'candidateId' | 'label' | 'isFirstLaunch';

export interface INewDetection {
  origin: DetectionOrigin;
  candidateId: string | null;
  watchList: Pick<DetectionWatch, DetectionWatchCopy>[];
}

// What a Detection records of a Watch as it goes: its step, its counts, then its verdict
export type DetectionWatchUpdate = Partial<Omit<DetectionWatch, DetectionWatchCopy>>;

// SQLite refused a second row on a unique index: here, a second running Detection
const UNIQUE_VIOLATION_SCHEMA = z.object({ code: z.literal('P2002') });

export interface INewPosting {
  candidateId: string;
  source: string;
  listedPosting: ListedPosting;
  jobDescription: JobDescription;
  isInZone: boolean;
  repostOf: Posting | undefined;
  location: Location;
}

// Read where Prisma records the migrations it applied (ADR-0004): a database it has not created
// yet, or one it cannot read, has them all pending
function hasPendingMigration(databasePath: string): boolean {
  const migrationList = readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name);
  try {
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const rowList = database
        .prepare(
          'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL',
        )
        .all();
      const appliedSet = new Set(APPLIED_MIGRATION_LIST_SCHEMA.parse(rowList).map(({ migration_name: name }) => name));
      return migrationList.some((name) => !appliedSet.has(name));
    } finally {
      database.close();
    }
  } catch {
    return true;
  }
}

// Migrates first, but only when a migration is pending: the Prisma CLI takes 0.3 s to start
// (ADR-0004). Prisma never leaves this file (ADR-0005).
export function openDatabase(databasePath: string) {
  const url = `file:${databasePath}`;
  if (hasPendingMigration(databasePath)) {
    execFileSync(process.execPath, [PRISMA_CLI_PATH, 'migrate', 'deploy'], {
      cwd: ROOT_DIRECTORY,
      env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: '1' },
      stdio: 'pipe',
      // A migration takes seconds: one that hangs fails the launch rather than holding it
      timeout: MIGRATION_TIMEOUT_MS,
    });
  }
  // Read at launch once the Default Deadline Period exists, then changed by the process that saves them (ADR-0011)
  let defaultDelayMonths = DEFAULT_DELAY_MONTHS;
  // Expired depends on the day, so every Posting read computes it rather than storing it
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) }).$extends({
    result: {
      posting: {
        isExpired: {
          needs: { deadline: true, publishedAt: true },
          compute: (posting) => isExpired(posting, new Date(), defaultDelayMonths),
        },
      },
    },
  });

  // A single Chosen Version per Artifact of a Posting
  function chooseStatementList({
    postingId,
    artifact,
    number,
  }: {
    postingId: number;
    artifact: Artifact;
    number: number;
  }) {
    return [
      prisma.version.updateMany({
        where: { postingId, artifact, number: { not: number } },
        data: { isChosen: false },
      }),
      prisma.version.updateMany({ where: { postingId, artifact, number }, data: { isChosen: true } }),
    ];
  }

  // Records the Detection with its Watches, unless one is already running: the unique running lock
  // refuses it atomically, even from another process. A Detection left running by a process that
  // died, untouched since staleBefore, is failed first so it no longer holds the lock.
  async function claimDetection(
    { origin, candidateId, watchList }: INewDetection,
    { staleBefore, interruptedError }: { staleBefore: Date; interruptedError: string },
  ): Promise<{ detection: RecordedDetection } | { runningSince: Date }> {
    await failStaleDetections({ staleBefore, interruptedError });
    try {
      const detection = RECORDED_DETECTION_SCHEMA.parse(
        await prisma.detection.create({
          data: {
            origin,
            candidateId,
            startedAt: new Date(),
            runningLock: true,
            watchList: {
              create: watchList.map((watch) => ({
                ...watch,
                newPostingList: [],
                nearMissList: [],
                notificationFailureList: [],
              })),
            },
          },
          include: DETECTION_INCLUDE,
        }),
      );
      return { detection };
    } catch (error) {
      if (!UNIQUE_VIOLATION_SCHEMA.safeParse(error).success) {
        throw error;
      }
    }
    const running = await prisma.detection.findFirst({ where: { runningLock: true }, select: { startedAt: true } });
    // Finished in between: the lock is free again
    return running === null
      ? claimDetection({ origin, candidateId, watchList }, { staleBefore, interruptedError })
      : { runningSince: running.startedAt };
  }

  // A Detection left running by a process that died, untouched since staleBefore, no longer runs
  async function failStaleDetections({
    staleBefore,
    interruptedError,
  }: {
    staleBefore: Date;
    interruptedError: string;
  }): Promise<void> {
    const staleList = await prisma.detection.findMany({
      where: { runningLock: true, updatedAt: { lt: staleBefore } },
      select: { id: true },
    });
    for (const { id } of staleList) {
      await finishDetection(id, interruptedError);
    }
  }

  // A failed Detection keeps each Watch at the step it stopped at
  async function finishDetection(id: number, error: string | null): Promise<void> {
    await prisma.detection.update({ where: { id }, data: { runningLock: null, finishedAt: new Date(), error } });
  }

  return {
    async listCandidates(): Promise<Candidate[]> {
      return z.array(CANDIDATE_SCHEMA).parse(await prisma.candidate.findMany({ orderBy: { name: 'asc' } }));
    },

    // A single Candidate by their identifier, null when there is none
    async findCandidate(candidateId: string): Promise<Candidate | null> {
      return CANDIDATE_SCHEMA.nullable().parse(await prisma.candidate.findUnique({ where: { id: candidateId } }));
    },

    // Secret Parameters included, for the actions to reduce or send, never to return (ADR-0006)
    async findNotificationChannel(candidateId: string): Promise<SavedNotificationChannel> {
      const { notificationChannel, ...candidate } = await prisma.candidate.findUniqueOrThrow({
        where: { id: candidateId },
        include: { notificationChannel: true },
      });
      return SAVED_NOTIFICATION_CHANNEL_SCHEMA.parse({
        candidate,
        module: notificationChannel?.module ?? null,
        parameters: notificationChannel?.parameters ?? {},
      });
    },

    // The Parameters replace the saved ones as a whole: the actions merge them first (ADR-0010)
    async saveNotificationChannel(
      candidateId: string,
      { module, parameters }: { module: string; parameters: Parameters },
    ) {
      await prisma.notificationChannel.upsert({
        where: { candidateId },
        create: { candidateId, module, parameters },
        update: { module, parameters },
      });
    },

    async createCandidate({ id, name, locale }: INewCandidate): Promise<void> {
      await prisma.candidate.create({ data: { id, name, locale } });
    },

    async renameCandidate({ id }: Candidate, name: string): Promise<void> {
      await prisma.candidate.update({ where: { id }, data: { name } });
    },

    async setCandidateLocale({ id }: Candidate, locale: Locale): Promise<void> {
      await prisma.candidate.update({ where: { id }, data: { locale } });
    },

    // Whether the Default Deadline Period exists: from then on, the config an older jf left is never read
    // again (ADR-0011)
    async hasDefaultDeadlinePeriod(): Promise<boolean> {
      return (await prisma.defaultDeadlinePeriod.count()) > 0;
    },

    // Creates the Default Deadline Period, from the config an older jf left when there is one: its Candidates
    // and Watches are added or updated, never deleted, and each Watch keeps when its Detection last
    // went through. The row is claimed first, so a process launched at the same time imports nothing.
    async createDefaultDeadlinePeriod(config: Config | null): Promise<void> {
      const delayMonths = config?.defaultDelayMonths ?? DEFAULT_DELAY_MONTHS;
      await prisma.$transaction(async (transaction) => {
        const claimedCount = await transaction.$executeRaw`
          INSERT INTO "DefaultDeadlinePeriod" ("id", "months") VALUES (${DEFAULT_DEADLINE_PERIOD_ID}, ${delayMonths})
          ON CONFLICT DO NOTHING`;
        if (claimedCount === 0 || config === null) {
          return;
        }
        for (const { id, name, locale, watchList } of config.candidateList) {
          await transaction.candidate.upsert({ where: { id }, create: { id, name, locale }, update: { name, locale } });
          for (const { id: watchId, source, parameters } of watchList) {
            const watch = { candidateId: id, source, parameters };
            await transaction.watch.upsert({
              where: { id: watchId },
              create: { id: watchId, ...watch },
              update: watch,
            });
          }
        }
      });
    },

    // Also what Expired computes with from then on, in this process
    async readDefaultDeadlinePeriod(): Promise<DefaultDeadlinePeriod> {
      const defaultDeadlinePeriod = DEFAULT_DEADLINE_PERIOD_SCHEMA.parse(
        await prisma.defaultDeadlinePeriod.findUniqueOrThrow({
          where: { id: DEFAULT_DEADLINE_PERIOD_ID },
          select: { months: true },
        }),
      );
      defaultDelayMonths = defaultDeadlinePeriod.months;
      return defaultDeadlinePeriod;
    },

    async saveDefaultDeadlinePeriod({ months }: DefaultDeadlinePeriod): Promise<void> {
      await prisma.defaultDeadlinePeriod.update({ where: { id: DEFAULT_DEADLINE_PERIOD_ID }, data: { months } });
      defaultDelayMonths = months;
    },

    // Every Watch, for the Detection, or those of a Candidate
    async listWatches(candidateId?: string): Promise<Watch[]> {
      return z.array(WATCH_SCHEMA).parse(
        await prisma.watch.findMany({
          where: candidateId === undefined ? {} : { candidateId },
          orderBy: { id: 'asc' },
        }),
      );
    },

    // A new Watch is on its first launch: detectedAt stays null
    async createWatch(watch: { id: string; candidateId: string; source: string; parameters: Parameters }) {
      await prisma.watch.create({ data: watch });
    },

    // A Watch whose Source or Parameters change starts its first launch again (ADR-0011)
    async updateWatch({ id }: Watch, { source, parameters }: { source: string; parameters: Parameters }) {
      await prisma.watch.update({ where: { id }, data: { source, parameters, detectedAt: null } });
    },

    // Its Postings stay: they belong to the Candidate, not to the Watch
    async deleteWatch({ id }: Watch): Promise<void> {
      await prisma.watch.delete({ where: { id } });
    },

    async listPostings(candidateId: string): Promise<Posting[]> {
      return z.array(POSTING_SCHEMA).parse(
        await prisma.posting.findMany({
          where: { candidateId },
          orderBy: { reference: 'desc' },
          include: POSTING_INCLUDE,
        }),
      );
    },

    // The To Apply Postings still followed that arrived last, through a Detection in the Zone or an
    // import, which no Zone holds but the Candidate chose (ADR-0003)
    async listLatestPostings(candidateId: string, count: number): Promise<Posting[]> {
      return z.array(POSTING_SCHEMA).parse(
        await prisma.posting.findMany({
          where: {
            candidateId,
            status: 'to_apply',
            archivedAt: null,
            OR: [{ isInZone: true }, { source: 'import' }],
          },
          orderBy: [{ detectedAt: 'desc' }, { id: 'desc' }],
          take: count,
          include: POSTING_INCLUDE,
        }),
      );
    },

    // A job the Candidate launches is not automatic: they see it run, and fail, on the screen
    async createJob(posting: Posting, module: Module, { isAutomatic = false } = {}): Promise<Job> {
      return JOB_SCHEMA.parse(
        await prisma.job.create({ data: { module, postingId: posting.id, isAutomatic }, include: JOB_INCLUDE }),
      );
    },

    // The job keeps its state: only its notification failed
    async failNotification({ id }: Job, { code, message }: { code: ErrorCode; message: string }): Promise<Job> {
      return JOB_SCHEMA.parse(
        await prisma.job.update({
          where: { id },
          data: { notificationErrorCode: code, notificationFailure: message },
          include: JOB_INCLUDE,
        }),
      );
    },

    // The job runs and its Version is created, numbered after the last Version of its Artifact,
    // with the Versions it reads
    async startJob(
      { id, module, posting }: Job & { module: Artifact },
      {
        instructions,
        hasCandidateInstructions,
        inputList,
      }: {
        instructions: string;
        hasCandidateInstructions: boolean;
        inputList: { posting: Posting; version: Version }[];
      },
    ): Promise<Version> {
      const { _max: max } = await prisma.version.aggregate({
        where: { postingId: posting.id, artifact: module },
        _max: { number: true },
      });
      const [, version] = await prisma.$transaction([
        prisma.job.update({ where: { id }, data: { state: 'running' } }),
        prisma.version.create({
          data: {
            postingId: posting.id,
            artifact: module,
            number: (max.number ?? 0) + 1,
            state: 'running',
            instructions,
            hasCandidateInstructions,
            jobId: id,
            inputList: {
              connect: inputList.map(({ posting: { id: postingId }, version: { artifact, number } }) => ({
                postingId_artifact_number: { postingId, artifact, number },
              })),
            },
          },
          include: VERSION_INCLUDE,
        }),
      ]);
      return VERSION_SCHEMA.parse(version);
    },

    // A ready Version becomes the Chosen Version: by default, the latest one is retained
    async finishJob(
      { job, version }: { job: Job; version: Version },
      { errorCode, log, sessionId }: { errorCode: ErrorCode | null; log: string; sessionId: string | null },
    ): Promise<{ job: Job; version: Version }> {
      // Ready unless it failed under a code
      const isReady = errorCode === null;
      const versionWhere = { postingId: job.posting.id, artifact: version.artifact, number: version.number };
      await prisma.$transaction([
        prisma.version.updateMany({ where: versionWhere, data: { state: isReady ? 'ready' : 'failed' } }),
        prisma.job.update({
          where: { id: job.id },
          data: { state: isReady ? 'done' : 'failed', log, errorCode, sessionId },
        }),
        ...(isReady ? chooseStatementList(versionWhere) : []),
      ]);
      return {
        job: JOB_SCHEMA.parse(await prisma.job.findUniqueOrThrow({ where: { id: job.id }, include: JOB_INCLUDE })),
        version: VERSION_SCHEMA.parse(
          await prisma.version.findUniqueOrThrow({
            where: { postingId_artifact_number: versionWhere },
            include: VERSION_INCLUDE,
          }),
        ),
      };
    },

    // A job that ran without a Version, such as an extraction, is done
    async finishJobWithoutVersion({ id }: Job, { log, sessionId }: { log: string; sessionId: string | null }) {
      return JOB_SCHEMA.parse(
        await prisma.job.update({ where: { id }, data: { state: 'done', log, sessionId }, include: JOB_INCLUDE }),
      );
    },

    async listJobs(posting: Posting): Promise<Job[]> {
      return z
        .array(JOB_SCHEMA)
        .parse(
          await prisma.job.findMany({ where: { postingId: posting.id }, include: JOB_INCLUDE, orderBy: { id: 'asc' } }),
        );
    },

    // A job of a Posting: those of a Profile are followed on its page
    async findJob(id: number): Promise<Job | null> {
      const job = await prisma.job.findUnique({ where: { id, postingId: { not: null } }, include: JOB_INCLUDE });
      return job === null ? null : JOB_SCHEMA.parse(job);
    },

    // The oldest queued job, now running, unless a job is already running: a single Claude session
    // at a time (ADR-0003). One statement, so SQLite claims it atomically, even for two workers.
    async claimNextJob(): Promise<QueuedJob | null> {
      const claimedList = z.array(z.object({ id: z.int() })).parse(
        await prisma.$queryRaw`
          UPDATE "Job" SET "state" = 'running', "startedAt" = ${new Date()}
          WHERE "id" = (SELECT "id" FROM "Job" WHERE "state" = 'queued' ORDER BY "id" LIMIT 1)
            AND NOT EXISTS (SELECT 1 FROM "Job" WHERE "state" = 'running')
          RETURNING "id"`,
      );
      const [claimed] = claimedList;
      return claimed === undefined
        ? null
        : QUEUED_JOB_SCHEMA.parse(
            await prisma.job.findUniqueOrThrow({ where: { id: claimed.id }, include: JOB_INCLUDE }),
          );
    },

    // The worker tells it runs: a job tells no worker runs once this is stale
    async beatWorker(): Promise<void> {
      const beatAt = new Date();
      await prisma.workerHeartbeat.upsert({
        where: { id: WORKER_HEARTBEAT_ID },
        create: { id: WORKER_HEARTBEAT_ID, beatAt },
        update: { beatAt },
      });
    },

    // When the worker last told it runs, null before it ever started
    async findWorkerBeat(): Promise<Date | null> {
      const heartbeat = await prisma.workerHeartbeat.findUnique({ where: { id: WORKER_HEARTBEAT_ID } });
      return heartbeat === null ? null : z.date().parse(heartbeat.beatAt);
    },

    // Fails the running jobs and their Versions, keeping the code of the failure and its message in
    // the job's log, in the locale of its Candidate, that of its Posting or of its Upload
    async failRunningJobs(
      composeError: (locale: Locale) => { code: ErrorCode; message: string },
    ): Promise<QueuedJob[]> {
      const runningList = await prisma.job.findMany({
        where: { state: 'running' },
        select: { id: true, candidate: true, posting: { select: { candidate: true } } },
      });
      const idList = runningList.map(({ id }) => id);
      await prisma.$transaction([
        prisma.version.updateMany({ where: { jobId: { in: idList } }, data: { state: 'failed' } }),
        ...runningList.map(({ id, candidate, posting }) => {
          const { code, message } = composeError(localeOf(candidate ?? posting?.candidate));
          return prisma.job.update({ where: { id }, data: { state: 'failed', log: message, errorCode: code } });
        }),
      ]);
      return z
        .array(QUEUED_JOB_SCHEMA)
        .parse(
          await prisma.job.findMany({ where: { id: { in: idList } }, include: JOB_INCLUDE, orderBy: { id: 'asc' } }),
        );
    },

    async createProfileJob(candidateId: string, upload: UploadFileName): Promise<ProfileJob> {
      return PROFILE_JOB_SCHEMA.parse(await prisma.job.create({ data: { module: 'conversion', candidateId, upload } }));
    },

    async listProfileJobs(candidateId: string): Promise<ProfileJob[]> {
      return z
        .array(PROFILE_JOB_SCHEMA)
        .parse(await prisma.job.findMany({ where: { candidateId }, orderBy: { id: 'asc' } }));
    },

    async finishProfileJob({ id }: ProfileJob, { log, sessionId }: { log: string; sessionId: string | null }) {
      return PROFILE_JOB_SCHEMA.parse(
        await prisma.job.update({ where: { id }, data: { state: 'done', log, sessionId } }),
      );
    },

    async listVersions(posting: Posting, artifact: Artifact): Promise<Version[]> {
      return z.array(VERSION_SCHEMA).parse(
        await prisma.version.findMany({
          where: { postingId: posting.id, artifact },
          orderBy: { number: 'asc' },
          include: VERSION_INCLUDE,
        }),
      );
    },

    async chooseVersion(posting: Posting, { artifact, number }: Version): Promise<void> {
      await prisma.$transaction(chooseStatementList({ postingId: posting.id, artifact, number }));
    },

    claimDetection,

    failStaleDetections,

    // Each update touches the Detection, which keeps it from going stale
    async updateDetectionWatch(
      { id }: RecordedDetection,
      watchId: string,
      update: DetectionWatchUpdate,
    ): Promise<void> {
      await prisma.$transaction([
        prisma.detectionWatch.updateMany({ where: { detectionId: id, watchId }, data: update }),
        prisma.detection.update({ where: { id }, data: { updatedAt: new Date() } }),
      ]);
    },

    async finishDetection({ id }: RecordedDetection, error: string | null): Promise<void> {
      await finishDetection(id, error);
    },

    // The running Detection and the last finished one that covered the Candidate's Watches, each with
    // only those Watches
    async findDetections(
      candidateId: string,
    ): Promise<{ running: RecordedDetection | null; last: RecordedDetection | null }> {
      const include = { watchList: { where: { candidateId }, orderBy: { id: 'asc' } } } as const;
      const running = await prisma.detection.findFirst({ where: { runningLock: true }, include });
      const last = await prisma.detection.findFirst({
        where: { finishedAt: { not: null }, watchList: { some: { candidateId } } },
        orderBy: { id: 'desc' },
        include,
      });
      return {
        running: RECORDED_DETECTION_SCHEMA.nullable().parse(running),
        last: RECORDED_DETECTION_SCHEMA.nullable().parse(last),
      };
    },

    async setDetected({ id }: Watch): Promise<void> {
      await prisma.watch.update({ where: { id }, data: { detectedAt: new Date() } });
    },

    // The Postings of its Candidate and Source that another Watch stored out of its own Zone since this
    // one last went through, all of them on its first launch: they may be in the Zone of this one
    async listOutOfZonePostingsSince({ candidateId, source, detectedAt }: Watch): Promise<Posting[]> {
      const since = detectedAt === null ? {} : { detectedAt: { gt: detectedAt } };
      return z.array(POSTING_SCHEMA).parse(
        await prisma.posting.findMany({
          where: { candidateId, source, isInZone: false, ...since },
          include: POSTING_INCLUDE,
        }),
      );
    },

    // A Posting is in the Zone as soon as it is in that of one of its Candidate's Watches
    async setInZone({ id }: Posting): Promise<Posting> {
      return POSTING_SCHEMA.parse(
        await prisma.posting.update({ where: { id }, data: { isInZone: true }, include: POSTING_INCLUDE }),
      );
    },

    async findPostings(reference: string): Promise<Posting[]> {
      return z
        .array(POSTING_SCHEMA)
        .parse(await prisma.posting.findMany({ where: { reference }, include: POSTING_INCLUDE }));
    },

    async listUnlocatedPostings(): Promise<Posting[]> {
      return z
        .array(POSTING_SCHEMA)
        .parse(await prisma.posting.findMany({ where: { latitude: null }, include: POSTING_INCLUDE }));
    },

    async setLocation({ id }: Posting, location: Location): Promise<void> {
      await prisma.posting.update({ where: { id }, data: location });
    },

    // The fields read in its Job Description replace those of the Posting, its title included
    async fillPosting(
      { id }: Posting,
      { title, jobDescription, location }: { title: string; jobDescription: JobDescription; location: Location },
    ) {
      const { deadline, employer, workplace, applicationEmail, contact1, contact2 } = jobDescription;
      const data = { title, deadline, employer, workplace, applicationEmail, contact1, contact2, ...location };
      return POSTING_SCHEMA.parse(await prisma.posting.update({ where: { id }, data, include: POSTING_INCLUDE }));
    },

    async setStatus(posting: Posting, status: Status): Promise<void> {
      const now = new Date();
      const appliedAt = findAppliedAt(posting, status, now);
      await prisma.posting.update({ where: { id: posting.id }, data: { status, appliedAt, statusChangedAt: now } });
    },

    // The Archived mark alone: the Status and appliedAt stay as they are (ADR-0007)
    async setArchivedAt({ id }: Posting, archivedAt: Date | null): Promise<void> {
      await prisma.posting.update({ where: { id }, data: { archivedAt } });
    },

    async setNotes({ id }: Posting, notes: string): Promise<void> {
      await prisma.posting.update({ where: { id }, data: { notes } });
    },

    async createPosting({
      candidateId,
      source,
      listedPosting,
      jobDescription,
      isInZone,
      repostOf,
      location,
    }: INewPosting): Promise<Posting> {
      const { reference, title, url, publishedAt } = listedPosting;
      const { deadline, employer, workplace, applicationEmail, contact1, contact2 } = jobDescription;
      const data = { candidateId, source, reference, title, url, publishedAt, deadline, employer, workplace };
      return POSTING_SCHEMA.parse(
        await prisma.posting.create({
          data: {
            ...data,
            ...location,
            applicationEmail,
            contact1,
            contact2,
            isInZone,
            repostOfId: repostOf?.id ?? null,
          },
          include: POSTING_INCLUDE,
        }),
      );
    },
  };
}
