-- Archived leaves the Status for a mark beside it (ADR-0007). An archived Posting goes back to Applied
-- if it was ever Applied, otherwise to To Apply, and keeps the mark, dated from this migration since
-- the day it was archived was never kept: the main checkout migrates the real data/.

-- AlterTable
ALTER TABLE "Posting" ADD COLUMN "archivedAt" DATETIME;

UPDATE "Posting"
SET "status" = CASE WHEN "appliedAt" IS NULL THEN 'to_apply' ELSE 'applied' END,
    "archivedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'archived';
