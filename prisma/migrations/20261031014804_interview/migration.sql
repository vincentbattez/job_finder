-- CreateTable
CREATE TABLE "Interview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postingId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "startAt" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "place" TEXT NOT NULL,
    "interviewers" TEXT NOT NULL,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Interview_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Interview_postingId_number_key" ON "Interview"("postingId", "number");
