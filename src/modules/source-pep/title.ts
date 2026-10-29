import { foldText } from '#/text/index.ts';

export type TitleMatch = 'retained' | 'near-miss' | 'rejected';

// A recruiter marks the feminine with « (e) », « .e » or a plain « e », and several posts with a
// plural: each word of the criteria accepts them (ADR-0001)
const INCLUSIVE_SUFFIX = String.raw`(?:\s?\(e\)|\.e|e)?s?`;

const WORD_SEPARATOR = String.raw`\s+`;

// Titles that name the job without being it, such as the head of a team of attachés de justice
const EXCLUDED_TITLE_LIST = ['chef du pole'];

// A near miss shares the criteria's first word without matching: listing those reveals a new way
// of writing the title (ADR-0001)
export function createTitleMatcher(criteriaTitle: string): (title: string) => TitleMatch {
  const wordList = foldText(criteriaTitle).split(/\s+/);
  const wordPatternList = wordList.map((word) => word + INCLUSIVE_SUFFIX);
  const titlePattern = new RegExp(String.raw`\b${wordPatternList.join(WORD_SEPARATOR)}\b`);
  const nearMissPattern = new RegExp(String.raw`\b${wordList[0] ?? ''}`);
  return (title) => {
    const normalizedTitle = foldText(title);
    const isExcluded = EXCLUDED_TITLE_LIST.some((excluded) => normalizedTitle.includes(excluded));
    if (!isExcluded && titlePattern.test(normalizedTitle)) {
      return 'retained';
    }
    return nearMissPattern.test(normalizedTitle) ? 'near-miss' : 'rejected';
  };
}
