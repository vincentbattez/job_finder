-- Artifacts speak English (spec #65): Version.artefact becomes artifact and isRetenue isChosen, each
-- stored Artifact and each module a Job names take their English value. Version is rebuilt so its
-- constraint names follow, and every row is copied, its inputs (_Input) included: the main checkout
-- migrates the real data/.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Version" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postingId" INTEGER NOT NULL,
    "artifact" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "isChosen" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "hasCandidateInstructions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" INTEGER,
    CONSTRAINT "Version_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Version_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Version" ("artifact", "createdAt", "hasCandidateInstructions", "id", "instructions", "isChosen", "jobId", "number", "postingId", "state")
SELECT
    CASE "artefact"
        WHEN 'recherche' THEN 'research'
        WHEN 'lettre' THEN 'letter'
        WHEN 'fiche_entretien' THEN 'interview_brief'
        WHEN 'visualisation' THEN 'visualization'
        ELSE "artefact"
    END,
    "createdAt", "hasCandidateInstructions", "id", "instructions", "isRetenue", "jobId", "number", "postingId", "state"
FROM "Version";
DROP TABLE "Version";
ALTER TABLE "new_Version" RENAME TO "Version";
CREATE UNIQUE INDEX "Version_jobId_key" ON "Version"("jobId");
CREATE UNIQUE INDEX "Version_postingId_artifact_number_key" ON "Version"("postingId", "artifact", "number");

-- The module each Job runs: an AI module is named after its Artifact; extraction and conversion stay
UPDATE "Job" SET "module" = CASE "module"
    WHEN 'recherche' THEN 'research'
    WHEN 'lettre' THEN 'letter'
    WHEN 'fiche_entretien' THEN 'interview_brief'
    WHEN 'visualisation' THEN 'visualization'
    ELSE "module"
END;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
