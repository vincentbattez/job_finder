-- CreateTable
CREATE TABLE "Detection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "origin" TEXT NOT NULL,
    "candidateId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "runningLock" BOOLEAN,
    "finishedAt" DATETIME,
    "error" TEXT
);

-- CreateTable
CREATE TABLE "DetectionWatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "detectionId" INTEGER NOT NULL,
    "watchId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'waiting',
    "isFirstLaunch" BOOLEAN NOT NULL,
    "listedCount" INTEGER,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "readTotal" INTEGER,
    "newPostingList" JSONB NOT NULL,
    "nearMissList" JSONB NOT NULL,
    "notificationFailureList" JSONB NOT NULL,
    CONSTRAINT "DetectionWatch_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "Detection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Detection_runningLock_key" ON "Detection"("runningLock");
