-- The Versions an older jf left come through the Draft (ADR-0019, spec #125): the Chosen Version of
-- each Artifact and the ready ones before it are Validated; those after it, and every Version of an
-- Artifact with no Chosen one, stay Drafts. Idempotent: running it again validates the same Versions.
UPDATE "Version"
SET "validation" = 'validated'
WHERE "state" = 'ready'
  AND EXISTS (
    SELECT 1 FROM "Version" AS "chosen"
    WHERE "chosen"."isChosen" = 1
      AND "chosen"."postingId" = "Version"."postingId"
      AND "chosen"."interviewId" IS "Version"."interviewId"
      AND "chosen"."artifact" = "Version"."artifact"
      AND "chosen"."number" >= "Version"."number"
  );
