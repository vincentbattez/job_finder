import { ORIGINAL_FILE_NAME, type Artifact } from '#/domain/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import { escapeMdxSyntax } from './mdx-escape.ts';
import { AI_MODULE_BY_ARTIFACT } from './registry.ts';

// Before ADR-0019 only the Letter kept the AI's text, as its first draft, which became its Original
const FIRST_DRAFT_ARTIFACT: Artifact = 'letter';

// The data migration of the Originals (spec #125): every AI Version keeps the AI's text as its Original. A
// Version an older jf left without one gets its current text as its Original, except a Letter: a Letter
// without its first draft was brought by the Candidate, and has none. An older MDX Version was written in
// Markdown: its text is escaped first, so its Original too (ADR-0020). Safe on every launch: a run keeps
// its Original before its Version is ready, so only the Versions of an older jf still lack one.
export async function keepMissingOriginals(workspace: Workspace): Promise<void> {
  const versionList = await workspace.listReadyAiVersions();
  for (const { posting, version } of versionList) {
    const { fileName, format } = AI_MODULE_BY_ARTIFACT[version.artifact];
    if (workspace.readVersionFile(posting, version, ORIGINAL_FILE_NAME) !== null) {
      continue;
    }
    if (version.artifact === FIRST_DRAFT_ARTIFACT) {
      await workspace.setBrought(version);
      continue;
    }
    const text = workspace.readVersionFile(posting, version, fileName);
    if (text === null) {
      continue;
    }
    if (format === 'mdx') {
      workspace.writeVersionDocument(posting, version, fileName, escapeMdxSyntax(text));
    }
    workspace.keepOriginal(posting, version, fileName);
  }
}
