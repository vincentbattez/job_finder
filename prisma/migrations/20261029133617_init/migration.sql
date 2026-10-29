-- CreateTable
CREATE TABLE "Candidat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Veille" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidatId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "zone" JSONB NOT NULL,
    CONSTRAINT "Veille_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "Candidat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Offre" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "candidatId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "publishedAt" DATETIME,
    "dateLimite" DATETIME,
    "employer" TEXT,
    "workplace" TEXT,
    "city" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "applicationEmail" TEXT,
    "contact1" TEXT,
    "contact2" TEXT,
    "status" TEXT NOT NULL DEFAULT 'a_traiter',
    "republicationOfId" INTEGER,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isInZone" BOOLEAN NOT NULL,
    CONSTRAINT "Offre_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "Candidat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Offre_republicationOfId_fkey" FOREIGN KEY ("republicationOfId") REFERENCES "Offre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Version" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "offreId" INTEGER NOT NULL,
    "artefact" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "isRetenue" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL,
    "consignes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Version_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "module" TEXT NOT NULL,
    "offreId" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "log" TEXT NOT NULL DEFAULT '',
    "sessionId" TEXT,
    CONSTRAINT "Job_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_Input" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_Input_A_fkey" FOREIGN KEY ("A") REFERENCES "Version" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_Input_B_fkey" FOREIGN KEY ("B") REFERENCES "Version" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Offre_candidatId_source_reference_key" ON "Offre"("candidatId", "source", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Version_offreId_artefact_number_key" ON "Version"("offreId", "artefact", "number");

-- CreateIndex
CREATE UNIQUE INDEX "_Input_AB_unique" ON "_Input"("A", "B");

-- CreateIndex
CREATE INDEX "_Input_B_index" ON "_Input"("B");
