import { ORIGINAL_FILE_NAME, type Artifact } from '#/domain/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import { AI_MODULE_BY_ARTIFACT } from './registry.ts';

// Before ADR-0019 only the Letter kept the AI's text, as its first draft, which became its Original
const FIRST_DRAFT_ARTIFACT: Artifact = 'letter';

// The data migration of the Originals (spec #125): every AI Version keeps the AI's text as its Original. A
// Version an older jf left without one gets its current text as its Original, except a Letter: a Letter
// without its first draft was brought by the Candidate, and has none. Safe on every launch: a run keeps
// its Original before its Version is ready, so only the Versions of an older jf still lack one.
export async function keepMissingOriginals(workspace: Workspace): Promise<void> {
  const versionList = await workspace.listReadyAiVersions();
  for (const { posting, version } of versionList) {
    // A Custom Artifact is the Candidate's own text: it has no Original
    if (version.artifact === 'custom') {
      continue;
    }
    const { fileName } = AI_MODULE_BY_ARTIFACT[version.artifact];
    if (workspace.readVersionFile(posting, version, ORIGINAL_FILE_NAME) !== null) {
      continue;
    }
    if (version.artifact === FIRST_DRAFT_ARTIFACT) {
      await workspace.setBrought(version);
    } else if (workspace.readVersionFile(posting, version, fileName) !== null) {
      workspace.keepOriginal(posting, version, fileName);
    }
  }
}
