import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { z } from 'zod/v4';

import {
  CANDIDATE_SCHEMA,
  DELAI_PAR_DEFAUT_SCHEMA,
  JOB_SCHEMA,
  OFFRE_SCHEMA,
  PROFILE_JOB_SCHEMA,
  QUEUED_JOB_SCHEMA,
  SAVED_CANAL_NOTIFICATION_SCHEMA,
  VEILLE_SCHEMA,
  VERSION_SCHEMA,
  type Artefact,
  type Candidate,
  type DelaiParDefaut,
  type FicheDePoste,
  type Job,
  type Lieu,
  type ListedOffre,
  type Module,
  type Offre,
  type Parametres,
  type ProfileJob,
  type QueuedJob,
  type SavedCanalNotification,
  type Statut,
  type UploadFileName,
  type Veille,
  type Version,
} from '#/domain/index.ts';
import { findPostuleeAt, isExpiree } from '#/statut/index.ts';
import { PrismaClient } from '#/workspace/generated/client.ts';

import type { Config } from './config.ts';

const ROOT_DIRECTORY = path.join(import.meta.dirname, '..', '..', '..');
const PRISMA_CLI_PATH = fileURLToPath(import.meta.resolve('prisma/build/index.js'));
const MIGRATIONS_DIRECTORY = path.join(ROOT_DIRECTORY, 'prisma', 'migrations');
const APPLIED_MIGRATION_LIST_SCHEMA = z.array(z.object({ migration_name: z.string() }));

const VERSION_INCLUDE = {
  inputList: { select: { artefact: true, number: true, offre: { select: { reference: true } } } },
};
const LINKED_OFFRE_SELECT = { select: { reference: true } };
const OFFRE_INCLUDE = {
  republicationOf: LINKED_OFFRE_SELECT,
  republicationList: { ...LINKED_OFFRE_SELECT, orderBy: { reference: 'asc' } },
} as const;
// The single row of the Délai par défaut every Candidate shares
const DELAI_PAR_DEFAUT_ID = 1;
// The Délai par défaut of a new database, that of the example config of older versions
const DEFAULT_DELAY_MONTHS = 6;

const JOB_INCLUDE = { offre: { include: OFFRE_INCLUDE }, version: { include: VERSION_INCLUDE } };

export interface INewOffre {
  candidateId: string;
  source: string;
  listedOffre: ListedOffre;
  ficheDePoste: FicheDePoste;
  isInZone: boolean;
  republicationOf: Offre | undefined;
  lieu: Lieu;
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
    });
  }
  // Read at launch once the Délai par défaut exists, then changed by the process that saves them (ADR-0011)
  let defaultDelayMonths = DEFAULT_DELAY_MONTHS;
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
  function retenirStatementList({
    offreId,
    artefact,
    number,
  }: {
    offreId: number;
    artefact: Artefact;
    number: number;
  }) {
    return [
      prisma.version.updateMany({ where: { offreId, artefact, number: { not: number } }, data: { isRetenue: false } }),
      prisma.version.updateMany({ where: { offreId, artefact, number }, data: { isRetenue: true } }),
    ];
  }

  return {
    async listCandidates(): Promise<Candidate[]> {
      return z.array(CANDIDATE_SCHEMA).parse(await prisma.candidate.findMany({ orderBy: { name: 'asc' } }));
    },

    // Secret Paramètres included, for the actions to reduce or send, never to return (ADR-0006)
    async findCanalNotification(candidateId: string): Promise<SavedCanalNotification> {
      const { name, canalNotification } = await prisma.candidate.findUniqueOrThrow({
        where: { id: candidateId },
        include: { canalNotification: true },
      });
      return SAVED_CANAL_NOTIFICATION_SCHEMA.parse({
        candidateName: name,
        module: canalNotification?.module ?? null,
        parametres: canalNotification?.parametres ?? {},
      });
    },

    // The Paramètres replace the saved ones as a whole: the actions merge them first (ADR-0010)
    async saveCanalNotification(
      candidateId: string,
      { module, parametres }: { module: string; parametres: Parametres },
    ) {
      await prisma.canalNotification.upsert({
        where: { candidateId },
        create: { candidateId, module, parametres },
        update: { module, parametres },
      });
    },

    async createCandidate({ id, name }: { id: string; name: string }): Promise<void> {
      await prisma.candidate.create({ data: { id, name } });
    },

    async renameCandidate({ id }: Candidate, name: string): Promise<void> {
      await prisma.candidate.update({ where: { id }, data: { name } });
    },

    // Whether the Délai par défaut exists: from then on, the config an older jf left is never read
    // again (ADR-0011)
    async hasDelaiParDefaut(): Promise<boolean> {
      return (await prisma.delaiParDefaut.count()) > 0;
    },

    // Creates the Délai par défaut, from the config an older jf left when there is one: its Candidates
    // and Veilles are added or updated, never deleted, and each Veille keeps when its Détection last
    // went through. The row is claimed first, so a process launched at the same time imports nothing.
    async createDelaiParDefaut(config: Config | null): Promise<void> {
      const delayMonths = config?.defaultDelayMonths ?? DEFAULT_DELAY_MONTHS;
      await prisma.$transaction(async (transaction) => {
        const claimedCount = await transaction.$executeRaw`
          INSERT INTO "DelaiParDefaut" ("id", "months") VALUES (${DELAI_PAR_DEFAUT_ID}, ${delayMonths})
          ON CONFLICT DO NOTHING`;
        if (claimedCount === 0 || config === null) {
          return;
        }
        for (const { id, name, veilleList } of config.candidateList) {
          await transaction.candidate.upsert({ where: { id }, create: { id, name }, update: { name } });
          for (const { id: veilleId, source, parametres } of veilleList) {
            const veille = { candidateId: id, source, parametres };
            await transaction.veille.upsert({
              where: { id: veilleId },
              create: { id: veilleId, ...veille },
              update: veille,
            });
          }
        }
      });
    },

    // Also what Expirée computes with from then on, in this process
    async readDelaiParDefaut(): Promise<DelaiParDefaut> {
      const delaiParDefaut = DELAI_PAR_DEFAUT_SCHEMA.parse(
        await prisma.delaiParDefaut.findUniqueOrThrow({ where: { id: DELAI_PAR_DEFAUT_ID }, select: { months: true } }),
      );
      defaultDelayMonths = delaiParDefaut.months;
      return delaiParDefaut;
    },

    async saveDelaiParDefaut({ months }: DelaiParDefaut): Promise<void> {
      await prisma.delaiParDefaut.update({ where: { id: DELAI_PAR_DEFAUT_ID }, data: { months } });
      defaultDelayMonths = months;
    },

    // Every Veille, for the Détection, or those of a Candidate
    async listVeilles(candidateId?: string): Promise<Veille[]> {
      return z.array(VEILLE_SCHEMA).parse(
        await prisma.veille.findMany({
          where: candidateId === undefined ? {} : { candidateId },
          orderBy: { id: 'asc' },
        }),
      );
    },

    // A new Veille is on its first launch: detectedAt stays null
    async createVeille(veille: { id: string; candidateId: string; source: string; parametres: Parametres }) {
      await prisma.veille.create({ data: veille });
    },

    // A Veille whose Source or Paramètres change starts its first launch again (ADR-0011)
    async updateVeille({ id }: Veille, { source, parametres }: { source: string; parametres: Parametres }) {
      await prisma.veille.update({ where: { id }, data: { source, parametres, detectedAt: null } });
    },

    // Its Offres stay: they belong to the Candidate, not to the Veille
    async deleteVeille({ id }: Veille): Promise<void> {
      await prisma.veille.delete({ where: { id } });
    },

    async listOffres(candidateId: string): Promise<Offre[]> {
      return z.array(OFFRE_SCHEMA).parse(
        await prisma.offre.findMany({
          where: { candidateId },
          orderBy: { reference: 'desc' },
          include: OFFRE_INCLUDE,
        }),
      );
    },

    async createJob(offre: Offre, module: Module): Promise<Job> {
      return JOB_SCHEMA.parse(await prisma.job.create({ data: { module, offreId: offre.id }, include: JOB_INCLUDE }));
    },

    // The job runs and its Version is created, numbered after the last Version of its Artefact,
    // with the Versions it reads
    async startJob(
      { id, module, offre }: Job & { module: Artefact },
      {
        instructions,
        hasCandidateInstructions,
        inputList,
      }: { instructions: string; hasCandidateInstructions: boolean; inputList: { offre: Offre; version: Version }[] },
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
            instructions,
            hasCandidateInstructions,
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
      const versionWhere = { offreId: job.offre.id, artefact: version.artefact, number: version.number };
      await prisma.$transaction([
        prisma.version.updateMany({ where: versionWhere, data: { state: isReady ? 'ready' : 'failed' } }),
        prisma.job.update({ where: { id: job.id }, data: { state: isReady ? 'done' : 'failed', log, sessionId } }),
        ...(isReady ? retenirStatementList(versionWhere) : []),
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

    // A job that ran without a Version, such as an extraction, is done
    async finishJobWithoutVersion({ id }: Job, { log, sessionId }: { log: string; sessionId: string | null }) {
      return JOB_SCHEMA.parse(
        await prisma.job.update({ where: { id }, data: { state: 'done', log, sessionId }, include: JOB_INCLUDE }),
      );
    },

    async listJobs(offre: Offre): Promise<Job[]> {
      return z
        .array(JOB_SCHEMA)
        .parse(
          await prisma.job.findMany({ where: { offreId: offre.id }, include: JOB_INCLUDE, orderBy: { id: 'asc' } }),
        );
    },

    // A job of an Offre: those of a Profile are followed on its page
    async findJob(id: number): Promise<Job | null> {
      const job = await prisma.job.findUnique({ where: { id, offreId: { not: null } }, include: JOB_INCLUDE });
      return job === null ? null : JOB_SCHEMA.parse(job);
    },

    // The oldest queued job, now running, unless a job is already running: a single Claude session
    // at a time (ADR-0003). One statement, so SQLite claims it atomically, even for two workers.
    async claimNextJob(): Promise<QueuedJob | null> {
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
        : QUEUED_JOB_SCHEMA.parse(
            await prisma.job.findUniqueOrThrow({ where: { id: claimed.id }, include: JOB_INCLUDE }),
          );
    },

    // Fails the running jobs and their Versions, keeping the reason in the job's log
    async failRunningJobs(log: string): Promise<QueuedJob[]> {
      const runningList = await prisma.job.findMany({ where: { state: 'running' }, select: { id: true } });
      const idList = runningList.map(({ id }) => id);
      await prisma.$transaction([
        prisma.version.updateMany({ where: { jobId: { in: idList } }, data: { state: 'failed' } }),
        prisma.job.updateMany({ where: { id: { in: idList } }, data: { state: 'failed', log } }),
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

    async listVersions(offre: Offre, artefact: Artefact): Promise<Version[]> {
      return z.array(VERSION_SCHEMA).parse(
        await prisma.version.findMany({
          where: { offreId: offre.id, artefact },
          orderBy: { number: 'asc' },
          include: VERSION_INCLUDE,
        }),
      );
    },

    async retenirVersion(offre: Offre, { artefact, number }: Version): Promise<void> {
      await prisma.$transaction(retenirStatementList({ offreId: offre.id, artefact, number }));
    },

    async setDetected({ id }: Veille): Promise<void> {
      await prisma.veille.update({ where: { id }, data: { detectedAt: new Date() } });
    },

    // The Offres of its Candidate and Source that another Veille stored out of its own Zone since this
    // one last went through, all of them on its first launch: they may be in the Zone of this one
    async listOutOfZoneOffresSince({ candidateId, source, detectedAt }: Veille): Promise<Offre[]> {
      const since = detectedAt === null ? {} : { detectedAt: { gt: detectedAt } };
      return z.array(OFFRE_SCHEMA).parse(
        await prisma.offre.findMany({
          where: { candidateId, source, isInZone: false, ...since },
          include: OFFRE_INCLUDE,
        }),
      );
    },

    // An Offre is in the Zone as soon as it is in that of one of its Candidate's Veilles
    async setInZone({ id }: Offre): Promise<Offre> {
      return OFFRE_SCHEMA.parse(
        await prisma.offre.update({ where: { id }, data: { isInZone: true }, include: OFFRE_INCLUDE }),
      );
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

    // The fields read in its Fiche de poste replace those of the Offre, its title included
    async fillOffre(
      { id }: Offre,
      { title, ficheDePoste, lieu }: { title: string; ficheDePoste: FicheDePoste; lieu: Lieu },
    ) {
      const { dateLimite, employer, workplace, applicationEmail, contact1, contact2 } = ficheDePoste;
      const data = { title, dateLimite, employer, workplace, applicationEmail, contact1, contact2, ...lieu };
      return OFFRE_SCHEMA.parse(await prisma.offre.update({ where: { id }, data, include: OFFRE_INCLUDE }));
    },

    async setStatut(offre: Offre, statut: Statut): Promise<void> {
      const postuleeAt = findPostuleeAt(offre, statut, new Date());
      await prisma.offre.update({ where: { id: offre.id }, data: { statut, postuleeAt } });
    },

    async createOffre({
      candidateId,
      source,
      listedOffre,
      ficheDePoste,
      isInZone,
      republicationOf,
      lieu,
    }: INewOffre): Promise<Offre> {
      const { reference, title, url, publishedAt } = listedOffre;
      const { dateLimite, employer, workplace, applicationEmail, contact1, contact2 } = ficheDePoste;
      const data = { candidateId, source, reference, title, url, publishedAt, dateLimite, employer, workplace };
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
  };
}
