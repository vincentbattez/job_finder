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
  DETECTED_POSTING_SCHEMA,
  INTERVIEW_SCHEMA,
  JOB_SCHEMA,
  POSTING_SCHEMA,
  PROFILE_JOB_SCHEMA,
  QUEUED_JOB_SCHEMA,
  RECORDED_DETECTION_SCHEMA,
  REVISION_SECTION_SCHEMA,
  SAVED_NOTIFICATION_CHANNEL_SCHEMA,
  STATUS_SCHEMA,
  VERSION_SCHEMA,
  WATCH_SCHEMA,
  type Artifact,
  type Candidate,
  type DefaultDeadlinePeriod,
  type DetectedPosting,
  type DetectionOrigin,
  type DetectionWatch,
  type Interview,
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
  type RevisionSection,
  type SavedNotificationChannel,
  type Status,
  type UploadFileName,
  type Version,
  type Watch,
} from '#/domain/index.ts';
import { findAppliedAt, findStep, isExpired } from '#/status/index.ts';
import { Prisma, PrismaClient } from '#/workspace/generated/client.ts';

import type { Config } from './config.ts';

const ROOT_DIRECTORY = path.join(import.meta.dirname, '..', '..', '..');
const PRISMA_CLI_PATH = fileURLToPath(import.meta.resolve('prisma/build/index.js'));
const MIGRATIONS_DIRECTORY = path.join(ROOT_DIRECTORY, 'prisma', 'migrations');
const APPLIED_MIGRATION_LIST_SCHEMA = z.array(z.object({ migration_name: z.string() }));

const VERSION_INTERVIEW_SELECT = { select: { number: true } };
const VERSION_INCLUDE = {
  interview: VERSION_INTERVIEW_SELECT,
  inputList: {
    select: {
      key: true,
      readVersion: {
        select: {
          artifact: true,
          number: true,
          posting: { select: { reference: true } },
          interview: VERSION_INTERVIEW_SELECT,
        },
      },
    },
    orderBy: { id: 'asc' },
  },
} as const;
const LINKED_POSTING_SELECT = { select: { reference: true } };
const POSTING_INCLUDE = {
  repostOf: LINKED_POSTING_SELECT,
  repostList: { ...LINKED_POSTING_SELECT, orderBy: { reference: 'asc' } },
  // What its step is computed from
  interviewList: { select: { startAt: true, durationMinutes: true } },
} as const;

const INTERVIEW_TIME_SCHEMA = z.object({ startAt: z.date(), durationMinutes: z.int() });

// What the step of a Posting row is computed from; the other fields pass through
const STEP_ROW_SCHEMA = z.looseObject({
  status: STATUS_SCHEMA,
  interviewList: z.array(INTERVIEW_TIME_SCHEMA),
});

// The step depends on the time, so every Posting read computes it rather than storing it, like Expired
// (ADR-0009); anything but a Posting row, such as the null Posting of a Profile job, is left as it is
function withStep(row: unknown): unknown {
  const parsed = STEP_ROW_SCHEMA.safeParse(row);
  return parsed.success ? { ...parsed.data, step: findStep(parsed.data, parsed.data.interviewList, new Date()) } : row;
}

const JOB_ROW_SCHEMA = z.looseObject({ posting: z.unknown() });

function withPostingStep(row: unknown): unknown {
  const parsed = JOB_ROW_SCHEMA.safeParse(row);
  return parsed.success ? { ...parsed.data, posting: withStep(parsed.data.posting) } : row;
}

// The domain schemas, over a database row that has yet to get its step
const POSTING_READ_SCHEMA = z.preprocess(withStep, POSTING_SCHEMA);
const JOB_READ_SCHEMA = z.preprocess(withPostingStep, JOB_SCHEMA);
const QUEUED_JOB_READ_SCHEMA = z.preprocess(withPostingStep, QUEUED_JOB_SCHEMA);

// By date, the number telling apart two at the same time
const INTERVIEW_ORDER_LIST: { startAt?: 'asc'; number?: 'asc' }[] = [{ startAt: 'asc' }, { number: 'asc' }];
// The single row of the Default Deadline Period every Candidate shares
const DEFAULT_DEADLINE_PERIOD_ID = 1;
// The Default Deadline Period of a new database, that of the example config of older versions
const DEFAULT_DELAY_MONTHS = 6;

const DETECTION_INCLUDE = { watchList: { orderBy: { id: 'asc' } } } as const;

const MIGRATION_TIMEOUT_MS = 2 * 60_000;

// The single row of the worker's heartbeat
const WORKER_HEARTBEAT_ID = 1;

const JOB_INCLUDE = { posting: { include: POSTING_INCLUDE }, interview: true, version: { include: VERSION_INCLUDE } };

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

// What the Candidate types of an Interview; its number and its edits are counted by the database
export type InterviewFields = Pick<Interview, 'startAt' | 'durationMinutes' | 'place' | 'interviewers'>;

export interface INewPosting {
  candidateId: string;
  source: string;
  listedPosting: ListedPosting;
  jobDescription: JobDescription;
  // New when detected, To Apply when imported (ADR-0018)
  status: Extract<Status, 'new' | 'to_apply'>;
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

  // A single Chosen Version per Artifact of a Posting, or of an Interview for an Artifact attached to one
  function chooseStatementList({ id }: Version) {
    return [
      prisma.$executeRaw`
        UPDATE "Version" SET "isChosen" = "id" = ${id}
        WHERE ("postingId", COALESCE("interviewId", 0), "artifact") =
          (SELECT "postingId", COALESCE("interviewId", 0), "artifact" FROM "Version" WHERE "id" = ${id})`,
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
      return z.array(POSTING_READ_SCHEMA).parse(
        await prisma.posting.findMany({
          where: { candidateId },
          orderBy: { reference: 'desc' },
          include: POSTING_INCLUDE,
        }),
      );
    },

    // A job the Candidate launches is not automatic: they see it run, and fail, on the screen. A module
    // attached to an Interview runs for one.
    async createJob(
      posting: Posting,
      module: Module,
      {
        isAutomatic = false,
        interview = null,
        inputKeyList = null,
      }: { isAutomatic?: boolean; interview?: Interview | null; inputKeyList?: string[] | null } = {},
    ): Promise<Job> {
      return JOB_READ_SCHEMA.parse(
        await prisma.job.create({
          data: {
            module,
            postingId: posting.id,
            interviewId: interview?.id ?? null,
            isAutomatic,
            inputKeyList: inputKeyList ?? Prisma.DbNull,
          },
          include: JOB_INCLUDE,
        }),
      );
    },

    // The job keeps its state: only its notification failed
    async failNotification({ id }: Job, { code, message }: { code: ErrorCode; message: string }): Promise<Job> {
      return JOB_READ_SCHEMA.parse(
        await prisma.job.update({
          where: { id },
          data: { notificationErrorCode: code, notificationFailure: message },
          include: JOB_INCLUDE,
        }),
      );
    },

    // The job runs and its Version is created, numbered after the last Version of its Artifact on its
    // Interview, or on its Posting without one, with the Inputs it reads
    async startJob(
      { id, module, posting, interview }: Job & { module: Artifact },
      {
        instructions,
        hasCandidateInstructions,
        inputList,
      }: {
        instructions: string;
        hasCandidateInstructions: boolean;
        // Each Input it reads, with the Version read for an Artifact Input
        inputList: { key: string; version: Version | null }[];
      },
    ): Promise<Version> {
      const interviewId = interview?.id ?? null;
      const { _max: max } = await prisma.version.aggregate({
        where: { postingId: posting.id, interviewId, artifact: module },
        _max: { number: true },
      });
      // Read before the transaction, the number stays unique by the indexes of Version: one taken meanwhile
      // fails the job rather than doubling a Version
      const [, version] = await prisma.$transaction([
        prisma.job.update({ where: { id }, data: { state: 'running' } }),
        prisma.version.create({
          data: {
            postingId: posting.id,
            interviewId,
            artifact: module,
            number: (max.number ?? 0) + 1,
            state: 'running',
            instructions,
            hasCandidateInstructions,
            jobId: id,
            inputList: {
              create: inputList.map(({ key, version: input }) => ({ key, readVersionId: input?.id ?? null })),
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
      // Ready unless it failed under a code; a ready Version stays a Draft until the Candidate validates it (ADR-0019)
      const isReady = errorCode === null;
      await prisma.$transaction([
        prisma.version.updateMany({ where: { id: version.id }, data: { state: isReady ? 'ready' : 'failed' } }),
        prisma.job.update({
          where: { id: job.id },
          data: { state: isReady ? 'done' : 'failed', log, errorCode, sessionId },
        }),
      ]);
      return {
        job: JOB_READ_SCHEMA.parse(await prisma.job.findUniqueOrThrow({ where: { id: job.id }, include: JOB_INCLUDE })),
        version: VERSION_SCHEMA.parse(
          await prisma.version.findUniqueOrThrow({ where: { id: version.id }, include: VERSION_INCLUDE }),
        ),
      };
    },

    // A job that ran without a Version, such as an extraction, is done
    async finishJobWithoutVersion({ id }: Job, { log, sessionId }: { log: string; sessionId: string | null }) {
      return JOB_READ_SCHEMA.parse(
        await prisma.job.update({ where: { id }, data: { state: 'done', log, sessionId }, include: JOB_INCLUDE }),
      );
    },

    async listJobs(posting: Posting): Promise<Job[]> {
      return z
        .array(JOB_READ_SCHEMA)
        .parse(
          await prisma.job.findMany({ where: { postingId: posting.id }, include: JOB_INCLUDE, orderBy: { id: 'asc' } }),
        );
    },

    // A job of a Posting: those of a Profile are followed on its page
    async findJob(id: number): Promise<Job | null> {
      const job = await prisma.job.findUnique({ where: { id, postingId: { not: null } }, include: JOB_INCLUDE });
      return job === null ? null : JOB_READ_SCHEMA.parse(job);
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
        : QUEUED_JOB_READ_SCHEMA.parse(
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
        .array(QUEUED_JOB_READ_SCHEMA)
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

    // Those of an Interview for an Artifact attached to one, else those of the Posting, without an Interview
    async listVersions(posting: Posting, artifact: Artifact, interview: Interview | null): Promise<Version[]> {
      return z.array(VERSION_SCHEMA).parse(
        await prisma.version.findMany({
          where: { postingId: posting.id, interviewId: interview?.id ?? null, artifact },
          orderBy: { number: 'asc' },
          include: VERSION_INCLUDE,
        }),
      );
    },

    // Validated and Chosen at once, the previous Chosen Version staying Validated (ADR-0019)
    async validateVersion(version: Version): Promise<void> {
      await prisma.$transaction([
        prisma.version.update({ where: { id: version.id }, data: { validation: 'validated' } }),
        ...chooseStatementList(version),
      ]);
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

    // The Near Misses of the last Detection that searched the Watch: none until a Detection went through
    // with its Parameters, a change of them starting its first launch again (ADR-0011)
    async listNearMisses({ id, detectedAt }: Watch): Promise<DetectedPosting[]> {
      if (detectedAt === null) {
        return [];
      }
      const last = await prisma.detectionWatch.findFirst({
        where: { watchId: id, step: { in: ['reading', 'notifying', 'done'] } },
        orderBy: { id: 'desc' },
        select: { nearMissList: true },
      });
      return z.array(DETECTED_POSTING_SCHEMA).parse(last?.nearMissList ?? []);
    },

    async findPostings(reference: string): Promise<Posting[]> {
      return z
        .array(POSTING_READ_SCHEMA)
        .parse(await prisma.posting.findMany({ where: { reference }, include: POSTING_INCLUDE }));
    },

    async listUnlocatedPostings(): Promise<Posting[]> {
      return z
        .array(POSTING_READ_SCHEMA)
        .parse(await prisma.posting.findMany({ where: { latitude: null }, include: POSTING_INCLUDE }));
    },

    // The Postings of these Sources that have no Start Date yet, which their Job Description may give
    async listPostingsWithoutStartDate(sourceIdList: string[]): Promise<Posting[]> {
      return z.array(POSTING_READ_SCHEMA).parse(
        await prisma.posting.findMany({
          where: { startDate: null, source: { in: sourceIdList } },
          include: POSTING_INCLUDE,
        }),
      );
    },

    async setStartDate({ id }: Posting, startDate: Date): Promise<void> {
      await prisma.posting.update({ where: { id }, data: { startDate } });
    },

    async setLocation({ id }: Posting, location: Location): Promise<void> {
      await prisma.posting.update({ where: { id }, data: location });
    },

    // The fields read in its Job Description replace those of the Posting, its title included
    async fillPosting(
      { id }: Posting,
      { title, jobDescription, location }: { title: string; jobDescription: JobDescription; location: Location },
    ) {
      const { deadline, startDate, employer, workplace, applicationEmail, contact1, contact2 } = jobDescription;
      const data = { title, deadline, startDate, employer, workplace, applicationEmail, contact1, contact2 };
      return POSTING_READ_SCHEMA.parse(
        await prisma.posting.update({ where: { id }, data: { ...data, ...location }, include: POSTING_INCLUDE }),
      );
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

    async setUnpublishedAt({ id }: Posting, unpublishedAt: Date | null): Promise<void> {
      await prisma.posting.update({ where: { id }, data: { unpublishedAt } });
    },

    async setNotes({ id }: Posting, notes: string): Promise<void> {
      await prisma.posting.update({ where: { id }, data: { notes } });
    },

    // By date, the next round after the previous one
    async listInterviews({ id }: Posting): Promise<Interview[]> {
      return z
        .array(INTERVIEW_SCHEMA)
        .parse(await prisma.interview.findMany({ where: { postingId: id }, orderBy: INTERVIEW_ORDER_LIST }));
    },

    // Null when the Posting has no Interview with that number
    async findInterview({ id }: Posting, number: number): Promise<Interview | null> {
      return INTERVIEW_SCHEMA.nullable().parse(
        await prisma.interview.findUnique({ where: { postingId_number: { postingId: id, number } } }),
      );
    },

    // Numbered after the last Interview of its Posting, like a Version
    async createInterview({ id }: Posting, fields: InterviewFields): Promise<Interview> {
      return INTERVIEW_SCHEMA.parse(
        await prisma.$transaction(async (transaction) => {
          const { _max: max } = await transaction.interview.aggregate({
            where: { postingId: id },
            _max: { number: true },
          });
          return transaction.interview.create({ data: { ...fields, postingId: id, number: (max.number ?? 0) + 1 } });
        }),
      );
    },

    // Each edit counts, so a calendar importing it again updates its event
    async updateInterview({ id }: Interview, fields: InterviewFields): Promise<void> {
      await prisma.interview.update({ where: { id }, data: { ...fields, editCount: { increment: 1 } } });
    },

    // Its Versions and their jobs go with it
    async deleteInterview({ id }: Interview): Promise<void> {
      await prisma.interview.delete({ where: { id } });
    },

    // In the order the Candidate first wrote them
    async listRevisionSections({ id }: Interview): Promise<RevisionSection[]> {
      return z.array(REVISION_SECTION_SCHEMA).parse(
        await prisma.revisionSection.findMany({
          where: { interviewId: id },
          orderBy: { id: 'asc' },
          select: { title: true, note: true, isMastered: true },
        }),
      );
    },

    // Created at its first note or mark, then kept by its title whatever Version is Chosen
    async saveRevisionSection(
      { id }: Interview,
      title: string,
      fields: { note: string } | { isMastered: boolean },
    ): Promise<void> {
      await prisma.revisionSection.upsert({
        where: { interviewId_title: { interviewId: id, title } },
        create: { interviewId: id, title, ...fields },
        update: fields,
      });
    },

    async createPosting({
      candidateId,
      source,
      listedPosting,
      jobDescription,
      status,
      repostOf,
      location,
    }: INewPosting): Promise<Posting> {
      const { reference, title, url, publishedAt } = listedPosting;
      const { deadline, startDate, employer, workplace, applicationEmail, contact1, contact2 } = jobDescription;
      const data = {
        candidateId,
        source,
        reference,
        title,
        url,
        publishedAt,
        deadline,
        startDate,
        employer,
        workplace,
      };
      return POSTING_READ_SCHEMA.parse(
        await prisma.posting.create({
          data: {
            ...data,
            ...location,
            applicationEmail,
            contact1,
            contact2,
            status,
            repostOfId: repostOf?.id ?? null,
          },
          include: POSTING_INCLUDE,
        }),
      );
    },
  };
}
