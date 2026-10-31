-- The Interview Brief and the Visualization are now attached to an Interview (spec #45): the Versions
-- of a Posting, without an Interview, go with their inputs and their jobs. On the real data/, that is
-- the single Interview Brief Version, failed and without content; the launch deletes its folder
-- (src/workspace/layout.ts). The main checkout migrates the real data/.
DELETE FROM "_Input"
WHERE "A" IN (SELECT "id" FROM "Version" WHERE "artifact" IN ('interview_brief', 'visualization'))
   OR "B" IN (SELECT "id" FROM "Version" WHERE "artifact" IN ('interview_brief', 'visualization'));
DELETE FROM "Version" WHERE "artifact" IN ('interview_brief', 'visualization');
DELETE FROM "Job" WHERE "module" IN ('interview_brief', 'visualization');

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "module" TEXT NOT NULL,
    "postingId" INTEGER,
    "interviewId" INTEGER,
    "candidateId" TEXT,
    "upload" TEXT,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "log" TEXT NOT NULL DEFAULT '',
    "errorCode" TEXT,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "notificationErrorCode" TEXT,
    "notificationFailure" TEXT,
    "sessionId" TEXT,
    "startedAt" DATETIME,
    CONSTRAINT "Job_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Job_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("candidateId", "errorCode", "id", "isAutomatic", "log", "module", "notificationErrorCode", "notificationFailure", "postingId", "sessionId", "startedAt", "state", "upload") SELECT "candidateId", "errorCode", "id", "isAutomatic", "log", "module", "notificationErrorCode", "notificationFailure", "postingId", "sessionId", "startedAt", "state", "upload" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE TABLE "new_Version" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postingId" INTEGER NOT NULL,
    "interviewId" INTEGER,
    "artifact" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "isChosen" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "hasCandidateInstructions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" INTEGER,
    CONSTRAINT "Version_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Version_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Version_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Version" ("artifact", "createdAt", "hasCandidateInstructions", "id", "instructions", "isChosen", "jobId", "number", "postingId", "state") SELECT "artifact", "createdAt", "hasCandidateInstructions", "id", "instructions", "isChosen", "jobId", "number", "postingId", "state" FROM "Version";
DROP TABLE "Version";
ALTER TABLE "new_Version" RENAME TO "Version";
CREATE UNIQUE INDEX "Version_jobId_key" ON "Version"("jobId");
CREATE UNIQUE INDEX "Version_postingId_interviewId_artifact_number_key" ON "Version"("postingId", "interviewId", "artifact", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
