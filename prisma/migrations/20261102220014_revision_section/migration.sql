-- CreateTable
CREATE TABLE "RevisionSection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "interviewId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "isMastered" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RevisionSection_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSection_interviewId_title_key" ON "RevisionSection"("interviewId", "title");
