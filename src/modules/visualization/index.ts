import type { IAiModule } from '#/ai-module/index.ts';

import { VISUALIZATION_DEFAULT_INSTRUCTIONS } from './instructions.ts';
import { composeVisualizationPrompt, VISUALIZATION_FILE_NAME } from './prompt.ts';

// A whole HTML page, without a script: the front's sandboxed frame runs none, so a diagram drawn by
// one would never show
function findFormatError(html: string): string | undefined {
  if (!/^<!doctype html>/i.test(html.trimStart()) || !/<\/html>\s*$/i.test(html)) {
    return "ce n'est pas une page HTML complète, de « <!DOCTYPE html> » à « </html> »";
  }
  return /<script\b/i.test(html) ? "il contient un script, que le front n'exécute pas" : undefined;
}

// The Visualization of a Posting: a headless Claude session writes a single HTML page from the Chosen
// Interview Brief, which the front shows (ADR-0003). It is regenerated, never corrected by hand.
export const VISUALIZATION_MODULE = {
  fileName: VISUALIZATION_FILE_NAME,
  outputFileList: [{ name: VISUALIZATION_FILE_NAME, findFormatError }],
  defaultInstructions: VISUALIZATION_DEFAULT_INSTRUCTIONS,
  composePrompt: composeVisualizationPrompt,
  requiredArtifactList: ['interview_brief'],
} satisfies IAiModule;
