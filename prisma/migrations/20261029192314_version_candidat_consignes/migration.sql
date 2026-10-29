-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Version" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "offreId" INTEGER NOT NULL,
    "artefact" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "isRetenue" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL,
    "consignes" TEXT NOT NULL,
    "hasCandidatConsignes" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" INTEGER,
    CONSTRAINT "Version_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Version_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Version" ("artefact", "consignes", "createdAt", "id", "isRetenue", "jobId", "number", "offreId", "state") SELECT "artefact", "consignes", "createdAt", "id", "isRetenue", "jobId", "number", "offreId", "state" FROM "Version";
DROP TABLE "Version";
ALTER TABLE "new_Version" RENAME TO "Version";
CREATE UNIQUE INDEX "Version_jobId_key" ON "Version"("jobId");
CREATE UNIQUE INDEX "Version_offreId_artefact_number_key" ON "Version"("offreId", "artefact", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
