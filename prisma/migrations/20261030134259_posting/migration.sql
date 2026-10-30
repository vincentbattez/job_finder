-- Postings speak English (spec #65): Offre becomes Posting, dateLimite deadline, postuleeAt appliedAt,
-- republicationOf repostOf, offreId postingId, and each stored Status takes its English value. Each
-- table is rebuilt so its constraint names follow, and every row is copied: the main checkout migrates
-- the real data/. Offre is dropped last, once nothing reads it.

-- CreateTable
CREATE TABLE "Posting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "candidateId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "publishedAt" DATETIME,
    "deadline" DATETIME,
    "employer" TEXT,
    "workplace" TEXT,
    "city" TEXT,
    "region" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "applicationEmail" TEXT,
    "contact1" TEXT,
    "contact2" TEXT,
    "status" TEXT NOT NULL DEFAULT 'to_apply',
    "appliedAt" DATETIME,
    "repostOfId" INTEGER,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isInZone" BOOLEAN NOT NULL,
    CONSTRAINT "Posting_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Posting_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "Posting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "Posting" (
    "id", "candidateId", "source", "reference", "title", "url", "publishedAt", "deadline", "employer",
    "workplace", "city", "region", "latitude", "longitude", "applicationEmail", "contact1", "contact2",
    "status", "appliedAt", "repostOfId", "detectedAt", "isInZone"
) SELECT
    "id", "candidateId", "source", "reference", "title", "url", "publishedAt", "dateLimite", "employer",
    "workplace", "city", "region", "latitude", "longitude", "applicationEmail", "contact1", "contact2",
    CASE "status" WHEN 'a_traiter' THEN 'to_apply' WHEN 'postulee' THEN 'applied' WHEN 'archivee' THEN 'archived' END,
    "postuleeAt", "republicationOfId", "detectedAt", "isInZone"
FROM "Offre";

-- CreateIndex
CREATE UNIQUE INDEX "Posting_candidateId_source_reference_key" ON "Posting"("candidateId", "source", "reference");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "module" TEXT NOT NULL,
    "postingId" INTEGER,
    "candidateId" TEXT,
    "upload" TEXT,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "log" TEXT NOT NULL DEFAULT '',
    "sessionId" TEXT,
    CONSTRAINT "Job_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("candidateId", "id", "log", "module", "postingId", "sessionId", "state", "upload") SELECT "candidateId", "id", "log", "module", "offreId", "sessionId", "state", "upload" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE TABLE "new_Version" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postingId" INTEGER NOT NULL,
    "artefact" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "isRetenue" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "hasCandidateInstructions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" INTEGER,
    CONSTRAINT "Version_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Version_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Version" ("artefact", "createdAt", "hasCandidateInstructions", "id", "instructions", "isRetenue", "jobId", "number", "postingId", "state") SELECT "artefact", "createdAt", "hasCandidateInstructions", "id", "instructions", "isRetenue", "jobId", "number", "offreId", "state" FROM "Version";
DROP TABLE "Version";
ALTER TABLE "new_Version" RENAME TO "Version";
CREATE UNIQUE INDEX "Version_jobId_key" ON "Version"("jobId");
CREATE UNIQUE INDEX "Version_postingId_artefact_number_key" ON "Version"("postingId", "artefact", "number");
DROP TABLE "Offre";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
