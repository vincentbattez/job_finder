-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Version" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postingId" INTEGER NOT NULL,
    "interviewId" INTEGER,
    "artifact" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "isChosen" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL,
    "validation" TEXT NOT NULL DEFAULT 'draft',
    "origin" TEXT NOT NULL DEFAULT 'ai',
    "instructions" TEXT NOT NULL,
    "hasCandidateInstructions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" INTEGER,
    CONSTRAINT "Version_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Version_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Version_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Version" ("artifact", "createdAt", "hasCandidateInstructions", "id", "instructions", "interviewId", "isChosen", "jobId", "number", "postingId", "state") SELECT "artifact", "createdAt", "hasCandidateInstructions", "id", "instructions", "interviewId", "isChosen", "jobId", "number", "postingId", "state" FROM "Version";
DROP TABLE "Version";
ALTER TABLE "new_Version" RENAME TO "Version";
CREATE UNIQUE INDEX "Version_jobId_key" ON "Version"("jobId");
CREATE UNIQUE INDEX "Version_postingId_interviewId_artifact_number_key" ON "Version"("postingId", "interviewId", "artifact", "number");
CREATE UNIQUE INDEX "Version_postingId_artifact_number_key" ON "Version"("postingId", "artifact", "number") WHERE "interviewId" IS NULL;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
