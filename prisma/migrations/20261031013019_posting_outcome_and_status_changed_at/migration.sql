-- Hired and Rejected join the stored Status, which SQLite keeps as text. The day of the last Status
-- change is that of Applied for a Posting Applied so far, the only change it could have had.

-- AlterTable
ALTER TABLE "Posting" ADD COLUMN "statusChangedAt" DATETIME;

UPDATE "Posting" SET "statusChangedAt" = "appliedAt" WHERE "status" = 'applied';
