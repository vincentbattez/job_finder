-- Watches and Detection speak English (spec #65): Veille becomes Watch, CanalNotification
-- NotificationChannel, DelaiParDefaut DefaultDeadlinePeriod, and each parametres column parameters.
-- Each table is created under its new name so its constraint names follow, and every row is copied:
-- the main checkout migrates the real data/. Watch.detectedAt is kept, so the next Detection of a
-- Watch is not a first launch. The French tables are dropped last, once copied.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "DefaultDeadlinePeriod" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "months" INTEGER NOT NULL
);
INSERT INTO "DefaultDeadlinePeriod" ("id", "months") SELECT "id", "months" FROM "DelaiParDefaut";

-- CreateTable
CREATE TABLE "NotificationChannel" (
    "candidateId" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    CONSTRAINT "NotificationChannel_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "NotificationChannel" ("candidateId", "module", "parameters")
SELECT "candidateId", "module", "parametres" FROM "CanalNotification";

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "detectedAt" DATETIME,
    CONSTRAINT "Watch_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "Watch" ("id", "candidateId", "source", "parameters", "detectedAt")
SELECT "id", "candidateId", "source", "parametres", "detectedAt" FROM "Veille";

-- DropTable
DROP TABLE "DelaiParDefaut";
DROP TABLE "CanalNotification";
DROP TABLE "Veille";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
