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
    "errorCode" TEXT,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "notificationErrorCode" TEXT,
    "notificationFailure" TEXT,
    "sessionId" TEXT,
    CONSTRAINT "Job_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("candidateId", "errorCode", "id", "log", "module", "postingId", "sessionId", "state", "upload") SELECT "candidateId", "errorCode", "id", "log", "module", "postingId", "sessionId", "state", "upload" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
