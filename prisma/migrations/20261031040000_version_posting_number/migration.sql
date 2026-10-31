-- CreateIndex
CREATE UNIQUE INDEX "Version_postingId_artifact_number_key" ON "Version"("postingId", "artifact", "number") WHERE "interviewId" IS NULL;

