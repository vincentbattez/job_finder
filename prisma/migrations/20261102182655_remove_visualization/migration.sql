-- The Visualization goes away (ADR-0020): its Versions go with the links to what they read and their
-- jobs; the launch deletes its folders (src/workspace/layout.ts). The main checkout migrates the real
-- data/. Deleting what is already gone changes nothing, so the migration is idempotent.
DELETE FROM "_Input"
WHERE "A" IN (SELECT "id" FROM "Version" WHERE "artifact" = 'visualization')
   OR "B" IN (SELECT "id" FROM "Version" WHERE "artifact" = 'visualization');
DELETE FROM "Version" WHERE "artifact" = 'visualization';
DELETE FROM "Job" WHERE "module" = 'visualization';
