import type { IAiModule } from '#/ai-module/index.ts';
import { tFor } from '#/domain/catalogue/i18n.ts';
import type { Locale } from '#/domain/index.ts';

import { composeResearchPrompt, RESEARCH_FILE_NAME } from './prompt.ts';

// A Research starts with its title and ends with its sources, at least one link
function findFormatError(markdown: string, locale: Locale): string | undefined {
  const t = tFor(locale, 'error');
  if (!markdown.trimStart().startsWith('# ')) {
    return t('noLevelOneHeading');
  }
  const sources = markdown.split(/^## Sources[ \t]*$/m, 2)[1] ?? '';
  return /https?:\/\//.test(sources) ? undefined : t('noSourcesSection');
}

// The Research of a Posting: a headless Claude session writes a single sourced Markdown file
// (ADR-0003)
export const RESEARCH_MODULE = {
  fileName: RESEARCH_FILE_NAME,
  outputFileList: [{ name: RESEARCH_FILE_NAME, findFormatError }],
  composePrompt: composeResearchPrompt,
  // Its sources are on the web
  isSearchingWeb: true,
  // A Repost starts from the work done for the Posting it publishes again
  isReadingRepostedPosting: true,
} satisfies IAiModule;
