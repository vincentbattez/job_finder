import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { z } from 'zod/v4';

import {
  CANDIDAT_SCHEMA,
  JOB_SCHEMA,
  OFFRE_SCHEMA,
  VEILLE_SCHEMA,
  VERSION_SCHEMA,
  type Artefact,
  type Candidat,
  type FicheDePoste,
  type Job,
  type Lieu,
  type ListedOffre,
  type Offre,
  type Veille,
  type Version,
} from '#/domain/index.ts';
import { isExpiree } from '#/statut/index.ts';
import { PrismaClient } from '#/workspace/generated/client.ts';

import type { Config } from './config.ts';

const ROOT_DIRECTORY = path.join(import.meta.dirname, '..', '..', '..');
const PRISMA_CLI_PATH = fileURLToPath(import.meta.resolve('prisma/build/index.js'));

const VERSION_INCLUDE = {
  inputList: { select: { artefact: true, number: true, offre: { select: { reference: true } } } },
};
const LINKED_OFFRE_SELECT = { select: { reference: true } };
const OFFRE_INCLUDE = {
  republicationOf: LINKED_OFFRE_SELECT,
  republicationList: { ...LINKED_OFFRE_SELECT, orderBy: { reference: 'asc' } },
} as const;
const JOB_INCLUDE = { offre: { include: OFFRE_INCLUDE }, version: { include: VERSION_INCLUDE } };

export interface INewOffre {
  candidatId: string;
  source: string;
  listedOffre: ListedOffre;
  fiche: FicheDePoste;
  isInZone: boolean;
  republicationOf: Offre | undefined;
  lieu: Lieu;
}

// Applies the pending migrations of prisma/migrations first, so the schema exists from the
// first launch and follows every upgrade. Prisma never leaves this file: every row read is
// parsed into a domain type (ADR-0005).
export function openDatabase(databasePath: string, defaultDelayMonths: number) {
  const url = `file:${databasePath}`;
  execFileSync(process.execPath, [PRISMA_CLI_PATH, 'migrate', 'deploy'], {
    cwd: ROOT_DIRECTORY,
    env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: '1' },
    stdio: 'pipe',
  });
  // Expirée depends on the day, so every Offre read computes it rather than storing it
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) }).$extends({
    result: {
      offre: {
        isExpiree: {
          needs: { dateLimite: true, publishedAt: true },
          compute: (offre) => isExpiree(offre, new Date(), defaultDelayMonths),
        },
      },
    },
  });

  // A single Version retenue per Artefact of an Offre
  function retainStatementList({ offreId, artefact, number }: { offreId: number; artefact: Artefact; number: number }) {
    return [
      prisma.version.updateMany({ where: { offreId, artefact, number: { not: number } }, data: { isRetenue: false } }),
      prisma.version.updateMany({ where: { offreId, artefact, number }, data: { isRetenue: true } }),
    ];
  }

  return {
    async listCandidats(): Promise<Candidat[]> {
      return z.array(CANDIDAT_SCHEMA).parse(await prisma.candidat.findMany({ orderBy: { name: 'asc' } }));
    },

    async listVeilles(): Promise<Veille[]> {
      return z.array(VEILLE_SCHEMA).parse(await prisma.veille.findMany({ orderBy: { id: 'asc' } }));
    },

    async listOffres(candidatId: string): Promise<Offre[]> {
      return z.array(OFFRE_SCHEMA).parse(
        await prisma.offre.findMany({
          where: { candidatId },
          orderBy: { reference: 'desc' },
          include: OFFRE_INCLUDE,
        }),
      );
    },

    async createJob(offre: Offre, module: Artefact): Promise<Job> {
      return JOB_SCHEMA.parse(await prisma.job.create({ data: { module, offreId: offre.id }, include: JOB_INCLUDE }));
    },

    // The job runs and its Version is created, numbered after the last Version of its Artefact,
    // with the Versions it reads
    async startJob(
      { id, module, offre }: Job,
      {
        consignes,
        hasCandidatConsignes,
        inputList,
      }: { consignes: string; hasCandidatConsignes: boolean; inputList: { offre: Offre; version: Version }[] },
    ): Promise<Version> {
      const { _max: max } = await prisma.version.aggregate({
        where: { offreId: offre.id, artefact: module },
        _max: { number: true },
      });
      const [, version] = await prisma.$transaction([
        prisma.job.update({ where: { id }, data: { state: 'running' } }),
        prisma.version.create({
          data: {
            offreId: offre.id,
            artefact: module,
            number: (max.number ?? 0) + 1,
            state: 'running',
            consignes,
            hasCandidatConsignes,
            jobId: id,
            inputList: {
              connect: inputList.map(({ offre: { id: offreId }, version: { artefact, number } }) => ({
                offreId_artefact_number: { offreId, artefact, number },
              })),
            },
          },
          include: VERSION_INCLUDE,
        }),
      ]);
      return VERSION_SCHEMA.parse(version);
    },

    // A ready Version becomes the Version retenue: by default, the latest one is retained
    async finishJob(
      { job, version }: { job: Job; version: Version },
      { isReady, log, sessionId }: { isReady: boolean; log: string; sessionId: string | null },
    ): Promise<{ job: Job; version: Version }> {
      const versionWhere = { offreId: job.offre.id, artefact: job.module, number: version.number };
      await prisma.$transaction([
        prisma.version.updateMany({ where: versionWhere, data: { state: isReady ? 'ready' : 'failed' } }),
        prisma.job.update({ where: { id: job.id }, data: { state: isReady ? 'done' : 'failed', log, sessionId } }),
        ...(isReady ? retainStatementList(versionWhere) : []),
      ]);
      return {
        job: JOB_SCHEMA.parse(await prisma.job.findUniqueOrThrow({ where: { id: job.id }, include: JOB_INCLUDE })),
        version: VERSION_SCHEMA.parse(
          await prisma.version.findUniqueOrThrow({
            where: { offreId_artefact_number: versionWhere },
            include: VERSION_INCLUDE,
          }),
        ),
      };
    },

    async listJobs(offre: Offre): Promise<Job[]> {
      return z
        .array(JOB_SCHEMA)
        .parse(
          await prisma.job.findMany({ where: { offreId: offre.id }, include: JOB_INCLUDE, orderBy: { id: 'asc' } }),
        );
    },

    async findJob(id: number): Promise<Job | null> {
      const job = await prisma.job.findUnique({ where: { id }, include: JOB_INCLUDE });
      return job === null ? null : JOB_SCHEMA.parse(job);
    },

    // The oldest queued job, now running, unless a job is already running: a single Claude session
    // at a time (ADR-0003). One statement, so SQLite claims it atomically, even for two workers.
    async claimNextJob(): Promise<Job | null> {
      const claimedList = z.array(z.object({ id: z.int() })).parse(
        await prisma.$queryRaw`
          UPDATE "Job" SET "state" = 'running'
          WHERE "id" = (SELECT "id" FROM "Job" WHERE "state" = 'queued' ORDER BY "id" LIMIT 1)
            AND NOT EXISTS (SELECT 1 FROM "Job" WHERE "state" = 'running')
          RETURNING "id"`,
      );
      const [claimed] = claimedList;
      return claimed === undefined
        ? null
        : JOB_SCHEMA.parse(await prisma.job.findUniqueOrThrow({ where: { id: claimed.id }, include: JOB_INCLUDE }));
    },

    // Fails the running jobs and their Versions, keeping the reason in the job's log
    async failRunningJobs(log: string): Promise<Job[]> {
      const runningList = await prisma.job.findMany({ where: { state: 'running' }, select: { id: true } });
      const idList = runningList.map(({ id }) => id);
      await prisma.$transaction([
        prisma.version.updateMany({ where: { jobId: { in: idList } }, data: { state: 'failed' } }),
        prisma.job.updateMany({ where: { id: { in: idList } }, data: { state: 'failed', log } }),
      ]);
      return z
        .array(JOB_SCHEMA)
        .parse(
          await prisma.job.findMany({ where: { id: { in: idList } }, include: JOB_INCLUDE, orderBy: { id: 'asc' } }),
        );
    },

    async listVersions(offre: Offre, artefact: Artefact): Promise<Version[]> {
      return z.array(VERSION_SCHEMA).parse(
        await prisma.version.findMany({
          where: { offreId: offre.id, artefact },
          orderBy: { number: 'asc' },
          include: VERSION_INCLUDE,
        }),
      );
    },

    async retainVersion(offre: Offre, { artefact, number }: Version): Promise<void> {
      await prisma.$transaction(retainStatementList({ offreId: offre.id, artefact, number }));
    },

    async listReferences(candidatId: string, source: string): Promise<string[]> {
      const offreList = await prisma.offre.findMany({ where: { candidatId, source }, select: { reference: true } });
      return z.array(z.string()).parse(offreList.map(({ reference }) => reference));
    },

    async findOffres(reference: string): Promise<Offre[]> {
      return z.array(OFFRE_SCHEMA).parse(await prisma.offre.findMany({ where: { reference }, include: OFFRE_INCLUDE }));
    },

    async listUnlocatedOffres(): Promise<Offre[]> {
      return z
        .array(OFFRE_SCHEMA)
        .parse(await prisma.offre.findMany({ where: { latitude: null }, include: OFFRE_INCLUDE }));
    },

    async setLieu({ id }: Offre, lieu: Lieu): Promise<void> {
      await prisma.offre.update({ where: { id }, data: lieu });
    },

    async setStatus(reference: string, status: Offre['status']): Promise<void> {
      await prisma.offre.updateMany({ where: { reference }, data: { status } });
    },

    async createOffre({
      candidatId,
      source,
      listedOffre,
      fiche,
      isInZone,
      republicationOf,
      lieu,
    }: INewOffre): Promise<Offre> {
      const { reference, title, url, publishedAt } = listedOffre;
      const { dateLimite, employer, workplace, applicationEmail, contact1, contact2 } = fiche;
      const data = { candidatId, source, reference, title, url, publishedAt, dateLimite, employer, workplace };
      return OFFRE_SCHEMA.parse(
        await prisma.offre.create({
          data: {
            ...data,
            ...lieu,
            applicationEmail,
            contact1,
            contact2,
            isInZone,
            republicationOfId: republicationOf?.id ?? null,
          },
          include: OFFRE_INCLUDE,
        }),
      );
    },

    // The config is the source of truth, so its Candidats and Veilles replace the copied rows.
    // Removing from the config a Candidat who still has Offres makes the launch fail, through the
    // foreign key, instead of leaving them orphaned.
    async copyConfig(config: Config): Promise<void> {
      const veilleList = config.candidatList.flatMap((candidat) =>
        candidat.veilleList.map((veille) => ({ ...veille, candidatId: candidat.id })),
      );
      await prisma.$transaction([
        prisma.veille.deleteMany(),
        prisma.candidat.deleteMany({ where: { id: { notIn: config.candidatList.map((candidat) => candidat.id) } } }),
        ...config.candidatList.map(({ id, name }) =>
          prisma.candidat.upsert({ where: { id }, create: { id, name }, update: { name } }),
        ),
        prisma.veille.createMany({ data: veilleList }),
      ]);
    },
  };
}
