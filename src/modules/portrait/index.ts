import type { IAiModule } from '#/ai-module/index.ts';
import { tFor } from '#/domain/catalogue/i18n.ts';
import type { Locale } from '#/domain/index.ts';

import { composePortraitPrompt, PORTRAIT_FILE_NAME } from './prompt.ts';

// A Portrait starts with its title; its depth is the session's judgment, under the Instructions
function findFormatError(markdown: string, locale: Locale): string | undefined {
  return markdown.trimStart().startsWith('# ') ? undefined : tFor(locale, 'error')('noLevelOneHeading');
}

// The Portrait of an Interview: a headless Claude session writes a single Markdown file on what is publicly
// known of its Interviewers, which the Candidate corrects before the Interview Brief builds on it (ADR-0003)
export const PORTRAIT_MODULE = {
  fileName: PORTRAIT_FILE_NAME,
  format: 'mdx',
  outputFileList: [{ name: PORTRAIT_FILE_NAME, findFormatError }],
  composePrompt: composePortraitPrompt,
  // Each Interview has its own Interviewers
  isAttachedToInterview: true,
  // The Research situates the Interviewers in their department, when the Candidate has one
  optionalArtifactList: ['research'],
  // What is publicly known of the Interviewers is on the web
  isSearchingWeb: true,
} satisfies IAiModule;
