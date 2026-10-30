-- The row of the settings becomes that of the Délai par défaut, without loss: the main checkout
-- migrates the real data/ (ADR-0011). Its existence still says the config an older jf left was
-- imported, so the import does not run again.

-- CreateTable
CREATE TABLE "DelaiParDefaut" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "months" INTEGER NOT NULL
);
INSERT INTO "DelaiParDefaut" ("id", "months") SELECT "id", "defaultDelayMonths" FROM "Settings";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Settings";
PRAGMA foreign_keys=on;
