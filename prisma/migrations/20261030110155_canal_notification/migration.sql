-- The Connexion Home Assistant of each Candidat becomes their Canal de notification, of the module
-- home-assistant, without loss: the main checkout migrates the real data/ (ADR-0010). json_patch
-- leaves out a field still null, which the module's schema then asks the Candidat to fill.

-- CreateTable
CREATE TABLE "CanalNotification" (
    "candidatId" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "parametres" JSONB NOT NULL,
    CONSTRAINT "CanalNotification_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "Candidat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CopyData
INSERT INTO "CanalNotification" ("candidatId", "module", "parametres")
SELECT "candidatId", 'home-assistant', json_patch('{}', json_object('url', "url", 'token', "token", 'service', "service"))
FROM "ConnexionHomeAssistant";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ConnexionHomeAssistant";
PRAGMA foreign_keys=on;
