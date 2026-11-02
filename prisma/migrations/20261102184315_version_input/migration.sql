-- Each Version records the Inputs its run read (ADR-0021): the links to the Versions it read become
-- recorded Inputs, keyed as the Artifact module resolves them, and nothing else is known of them. A job
-- keeps the Inputs the Candidate checked. The main checkout migrates the real data/; INSERT OR IGNORE
-- on the unique key keeps the copy idempotent.
ALTER TABLE "Job" ADD COLUMN "inputKeyList" JSONB;

CREATE TABLE "VersionInput" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "versionId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "readVersionId" INTEGER,
    CONSTRAINT "VersionInput_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VersionInput_readVersionId_fkey" FOREIGN KEY ("readVersionId") REFERENCES "Version" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VersionInput_versionId_key_key" ON "VersionInput"("versionId", "key");

-- In "_Input", A is the Version that read B: a Version of its own Posting is an Artifact Input, on its
-- Interview when it has one; another Posting's (a Repost's or a sent Letter) is named by its reference
INSERT OR IGNORE INTO "VersionInput" ("versionId", "key", "readVersionId")
SELECT "link"."A",
       CASE WHEN "read"."postingId" = "reader"."postingId"
            THEN 'artifact:' || "read"."artifact" || COALESCE('@' || "interview"."number", '')
            ELSE 'posting:' || "posting"."reference" || '/' || "read"."artifact"
       END,
       "link"."B"
FROM "_Input" AS "link"
JOIN "Version" AS "reader" ON "reader"."id" = "link"."A"
JOIN "Version" AS "read" ON "read"."id" = "link"."B"
JOIN "Posting" AS "posting" ON "posting"."id" = "read"."postingId"
LEFT JOIN "Interview" AS "interview" ON "interview"."id" = "read"."interviewId";

PRAGMA foreign_keys=off;
DROP TABLE "_Input";
PRAGMA foreign_keys=on;
