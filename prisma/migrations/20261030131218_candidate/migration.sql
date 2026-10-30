-- The Candidate side speaks English (spec #65): Candidat becomes Candidate, candidatId candidateId,
-- Job.piece upload, Version.consignes instructions. Each table is rebuilt so its constraint names follow,
-- and every row is copied: the main checkout migrates the real data/. Candidat is dropped last, once
-- nothing reads it.

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);
INSERT INTO "Candidate" ("id", "name") SELECT "id", "name" FROM "Candidat";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CanalNotification" (
    "candidateId" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "parametres" JSONB NOT NULL,
    CONSTRAINT "CanalNotification_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CanalNotification" ("candidateId", "module", "parametres") SELECT "candidatId", "module", "parametres" FROM "CanalNotification";
DROP TABLE "CanalNotification";
ALTER TABLE "new_CanalNotification" RENAME TO "CanalNotification";
CREATE TABLE "new_Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "module" TEXT NOT NULL,
    "offreId" INTEGER,
    "candidateId" TEXT,
    "upload" TEXT,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "log" TEXT NOT NULL DEFAULT '',
    "sessionId" TEXT,
    CONSTRAINT "Job_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("id", "log", "module", "offreId", "candidateId", "upload", "sessionId", "state") SELECT "id", "log", "module", "offreId", "candidatId", "piece", "sessionId", "state" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE TABLE "new_Offre" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "candidateId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "publishedAt" DATETIME,
    "dateLimite" DATETIME,
    "employer" TEXT,
    "workplace" TEXT,
    "city" TEXT,
    "region" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "applicationEmail" TEXT,
    "contact1" TEXT,
    "contact2" TEXT,
    "status" TEXT NOT NULL DEFAULT 'a_traiter',
    "postuleeAt" DATETIME,
    "republicationOfId" INTEGER,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isInZone" BOOLEAN NOT NULL,
    CONSTRAINT "Offre_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Offre_republicationOfId_fkey" FOREIGN KEY ("republicationOfId") REFERENCES "Offre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Offre" ("candidateId", "applicationEmail", "city", "contact1", "contact2", "dateLimite", "detectedAt", "employer", "id", "isInZone", "latitude", "longitude", "postuleeAt", "publishedAt", "reference", "region", "republicationOfId", "source", "status", "title", "url", "workplace") SELECT "candidatId", "applicationEmail", "city", "contact1", "contact2", "dateLimite", "detectedAt", "employer", "id", "isInZone", "latitude", "longitude", "postuleeAt", "publishedAt", "reference", "region", "republicationOfId", "source", "status", "title", "url", "workplace" FROM "Offre";
DROP TABLE "Offre";
ALTER TABLE "new_Offre" RENAME TO "Offre";
CREATE UNIQUE INDEX "Offre_candidateId_source_reference_key" ON "Offre"("candidateId", "source", "reference");
CREATE TABLE "new_Veille" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "parametres" JSONB NOT NULL,
    "detectedAt" DATETIME,
    CONSTRAINT "Veille_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Veille" ("candidateId", "detectedAt", "id", "parametres", "source") SELECT "candidatId", "detectedAt", "id", "parametres", "source" FROM "Veille";
DROP TABLE "Veille";
ALTER TABLE "new_Veille" RENAME TO "Veille";
CREATE TABLE "new_Version" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "offreId" INTEGER NOT NULL,
    "artefact" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "isRetenue" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "hasCandidateInstructions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" INTEGER,
    CONSTRAINT "Version_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Version_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Version" ("artefact", "createdAt", "id", "isRetenue", "jobId", "number", "offreId", "state", "instructions", "hasCandidateInstructions") SELECT "artefact", "createdAt", "id", "isRetenue", "jobId", "number", "offreId", "state", "consignes", "hasCandidatConsignes" FROM "Version";
DROP TABLE "Version";
ALTER TABLE "new_Version" RENAME TO "Version";
CREATE UNIQUE INDEX "Version_jobId_key" ON "Version"("jobId");
CREATE UNIQUE INDEX "Version_offreId_artefact_number_key" ON "Version"("offreId", "artefact", "number");
DROP TABLE "Candidat";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
