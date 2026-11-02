import type { IAiModule } from '#/ai-module/index.ts';
import { tFor } from '#/domain/catalogue/i18n.ts';
import type { Locale } from '#/domain/index.ts';

import { composeInterviewBriefPrompt, INTERVIEW_BRIEF_FILE_NAME } from './prompt.ts';

// An Interview Brief starts with its title; its plan is that of the Instructions, which the
// Candidate may change
function findFormatError(markdown: string, locale: Locale): string | undefined {
  return markdown.trimStart().startsWith('# ') ? undefined : tFor(locale, 'error')('noLevelOneHeading');
}

// The Interview Brief of an Interview: a headless Claude session writes a single Markdown file, to
// revise and train before that round, whose Interviewers it targets (ADR-0003)
export const INTERVIEW_BRIEF_MODULE = {
  alias: 'brief',
  fileName: INTERVIEW_BRIEF_FILE_NAME,
  format: 'mdx',
  outputFileList: [{ name: INTERVIEW_BRIEF_FILE_NAME, findFormatError }],
  composePrompt: composeInterviewBriefPrompt,
  // A first round and a job-specific interview are not prepared the same way
  isAttachedToInterview: true,
  // The Interview Brief builds on the Chosen Research of its Posting, and on its Chosen Letter
  // once there is one, to prepare the questions on what the Candidate wrote; on the Chosen Portrait of
  // its Interview too, when there is one, to adapt the pitch to the Interviewers
  requiredArtifactList: ['research'],
  optionalArtifactList: ['letter', 'portrait'],
  // What the previous rounds covered, and what the Candidate learned since, in the Notes
  previousInterviewArtifactList: ['interview_brief'],
  isReadingNotes: true,
  isReadingProfile: true,
} satisfies IAiModule;
