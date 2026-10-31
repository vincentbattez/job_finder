-- AlterTable
ALTER TABLE "Job" ADD COLUMN "startedAt" DATETIME;

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "beatAt" DATETIME NOT NULL
);
