-- A detected Posting now starts New until the Candidate sorts it (ADR-0018). The To Apply Postings
-- nobody sorted, never Applied and with no Research, neither a Version nor a job, become New. The main
-- checkout migrates the real data/. A New Posting is no longer To Apply, so the migration is idempotent.
UPDATE "Posting"
SET "status" = 'new'
WHERE "status" = 'to_apply'
  AND "appliedAt" IS NULL
  AND "id" NOT IN (SELECT "postingId" FROM "Version" WHERE "artifact" = 'research')
  AND "id" NOT IN (SELECT "postingId" FROM "Job" WHERE "module" = 'research' AND "postingId" IS NOT NULL);
