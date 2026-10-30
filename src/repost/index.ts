import type { Posting } from '#/domain/index.ts';
import { wordListOf } from '#/text/index.ts';

type IComparedPosting = Pick<Posting, 'reference' | 'title' | 'workplace' | 'applicationEmail'>;

// A field left empty is the same as no other
function isSameField(left: string | null, right: string | null): boolean {
  const leftKey = wordListOf(left ?? '').join(' ');
  return leftKey !== '' && leftKey === wordListOf(right ?? '').join(' ');
}

// A word without the marks of the feminine and the plural, which recruiters write in many ways:
// « attaché(e)s », « attachée » and « attaché » are one word (ADR-0001) cspell:ignore attachée
function stemOf(word: string): string {
  let stem = word.endsWith('s') ? word.slice(0, -1) : word;
  while (stem.endsWith('e')) {
    stem = stem.slice(0, -1);
  }
  return stem;
}

// The Position a title names, set apart from its inclusive writing and from its jurisdiction, already in
// the workplace (« TJ » abbreviates the Tribunal judiciaire it names in full)
function positionOf(title: string, workplace: string | null): string {
  const jurisdictionStemSet = new Set([...wordListOf(workplace ?? '').map((word) => stemOf(word)), 'tj']);
  return wordListOf(title)
    .map((word) => stemOf(word))
    .filter((stem) => stem !== '' && !jurisdictionStemSet.has(stem))
    .join(' ');
}

// The service in the title tells apart the Positions of one jurisdiction, which share workplace and
// mail; the latest Posting when the Position was published several times
export function findRepostedPosting<T extends IComparedPosting>(
  posting: IComparedPosting,
  postingList: T[],
): T | undefined {
  return postingList
    .filter(
      (earlierPosting) =>
        isSameField(earlierPosting.workplace, posting.workplace) &&
        isSameField(earlierPosting.applicationEmail, posting.applicationEmail) &&
        positionOf(earlierPosting.title, earlierPosting.workplace) === positionOf(posting.title, posting.workplace),
    )
    .toSorted((left, right) => right.reference.localeCompare(left.reference))[0];
}
