-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Posting" (
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
    "archivedAt" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "repostOfId" INTEGER,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isInZone" BOOLEAN NOT NULL,
    CONSTRAINT "Posting_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Posting_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "Posting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Posting" ("applicationEmail", "appliedAt", "archivedAt", "candidateId", "city", "contact1", "contact2", "deadline", "detectedAt", "employer", "id", "isInZone", "latitude", "longitude", "publishedAt", "reference", "region", "repostOfId", "source", "status", "title", "url", "workplace") SELECT "applicationEmail", "appliedAt", "archivedAt", "candidateId", "city", "contact1", "contact2", "deadline", "detectedAt", "employer", "id", "isInZone", "latitude", "longitude", "publishedAt", "reference", "region", "repostOfId", "source", "status", "title", "url", "workplace" FROM "Posting";
DROP TABLE "Posting";
ALTER TABLE "new_Posting" RENAME TO "Posting";
CREATE UNIQUE INDEX "Posting_candidateId_source_reference_key" ON "Posting"("candidateId", "source", "reference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
