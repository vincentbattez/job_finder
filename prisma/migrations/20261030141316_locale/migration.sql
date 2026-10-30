-- Each Candidate gets the locale of the interface (spec #65), French for every one already there:
-- Léa reads it as before. Every row is copied: the main checkout migrates the real data/.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr'
);
INSERT INTO "new_Candidate" ("id", "name") SELECT "id", "name" FROM "Candidate";
DROP TABLE "Candidate";
ALTER TABLE "new_Candidate" RENAME TO "Candidate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
