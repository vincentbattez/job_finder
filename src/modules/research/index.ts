import type { IAiModule } from '#/ai-module/index.ts';

import { RESEARCH_DEFAULT_INSTRUCTIONS } from './instructions.ts';
import { composeResearchPrompt, RESEARCH_FILE_NAME } from './prompt.ts';

// A Research starts with its title and ends with its sources, at least one link
function findFormatError(markdown: string): string | undefined {
  if (!markdown.trimStart().startsWith('# ')) {
    return 'il ne commence pas par un titre de niveau 1 (« # »)';
  }
  const sources = markdown.split(/^## Sources[ \t]*$/m, 2)[1] ?? '';
  return /https?:\/\//.test(sources) ? undefined : "il n'a pas de section « ## Sources » avec au moins un lien";
}

// The Research of a Posting: a headless Claude session writes a single sourced Markdown file
// (ADR-0003)
export const RESEARCH_MODULE = {
  fileName: RESEARCH_FILE_NAME,
  outputFileList: [{ name: RESEARCH_FILE_NAME, findFormatError }],
  defaultInstructions: RESEARCH_DEFAULT_INSTRUCTIONS,
  composePrompt: composeResearchPrompt,
  // A Repost starts from the work done for the Posting it publishes again
  isReadingRepostedPosting: true,
} satisfies IAiModule;
