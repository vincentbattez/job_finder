import type { IAiModule } from '#/ai-module/index.ts';
import { catalogueFor } from '#/domain/catalogue/index.ts';
import type { Locale } from '#/domain/index.ts';

import { composeVisualizationPrompt, VISUALIZATION_FILE_NAME } from './prompt.ts';

// A whole HTML page, without a script: the front's sandboxed frame runs none, so a diagram drawn by
// one would never show
function findFormatError(html: string, locale: Locale): string | undefined {
  const { error } = catalogueFor(locale);
  if (!/^<!doctype html>/i.test(html.trimStart()) || !/<\/html>\s*$/i.test(html)) {
    return error.notACompletePage;
  }
  return /<script\b/i.test(html) ? error.hasScript : undefined;
}

// The Visualization of a Posting: a headless Claude session writes a single HTML page from the Chosen
// Interview Brief, which the front shows (ADR-0003). It is regenerated, never corrected by hand.
export const VISUALIZATION_MODULE = {
  fileName: VISUALIZATION_FILE_NAME,
  outputFileList: [{ name: VISUALIZATION_FILE_NAME, findFormatError }],
  composePrompt: composeVisualizationPrompt,
  requiredArtifactList: ['interview_brief'],
} satisfies IAiModule;
