-- The criteria and the Zone of each Veille become the Paramètres of its Source, without loss: the
-- main checkout migrates the real data/ (ADR-0010). json_patch merges the two objects, whose keys
-- differ, and detectedAt stays, so a first launch already over stays over.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Veille" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidatId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "parametres" JSONB NOT NULL,
    "detectedAt" DATETIME,
    CONSTRAINT "Veille_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "Candidat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Veille" ("candidatId", "detectedAt", "id", "source", "parametres") SELECT "candidatId", "detectedAt", "id", "source", json_patch("criteria", "zone") FROM "Veille";
DROP TABLE "Veille";
ALTER TABLE "new_Veille" RENAME TO "Veille";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
