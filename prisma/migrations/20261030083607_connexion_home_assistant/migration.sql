-- CreateTable
CREATE TABLE "ConnexionHomeAssistant" (
    "candidatId" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT,
    "token" TEXT,
    "service" TEXT,
    CONSTRAINT "ConnexionHomeAssistant_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "Candidat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
