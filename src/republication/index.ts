import type { Offre } from '#/domain/index.ts';
import { wordListOf } from '#/text/index.ts';

type IComparedOffre = Pick<Offre, 'reference' | 'title' | 'workplace' | 'applicationEmail'>;

// A field left empty is the same as no other
function isSameField(left: string | null, right: string | null): boolean {
  const leftKey = wordListOf(left ?? '').join(' ');
  return leftKey !== '' && leftKey === wordListOf(right ?? '').join(' ');
}

// A word without the marks of the feminine and the plural, which recruiters write in many ways:
// « attaché(e)s », « attachée » and « attaché » are one word (ADR-0001)
function stemOf(word: string): string {
  let stem = word.endsWith('s') ? word.slice(0, -1) : word;
  while (stem.endsWith('e')) {
    stem = stem.slice(0, -1);
  }
  return stem;
}

// The Poste a title names, set apart from its inclusive writing and from its juridiction, already in
// the workplace (« TJ » abbreviates the Tribunal judiciaire it names in full)
function posteOf(title: string, workplace: string | null): string {
  const juridictionStemSet = new Set([...wordListOf(workplace ?? '').map((word) => stemOf(word)), 'tj']);
  return wordListOf(title)
    .map((word) => stemOf(word))
    .filter((stem) => stem !== '' && !juridictionStemSet.has(stem))
    .join(' ');
}

// The service in the title tells apart the Postes of one juridiction, which share workplace and
// mail; the latest Offre when the Poste was published several times
export function findRepublishedOffre<T extends IComparedOffre>(offre: IComparedOffre, offreList: T[]): T | undefined {
  return offreList
    .filter(
      (earlierOffre) =>
        isSameField(earlierOffre.workplace, offre.workplace) &&
        isSameField(earlierOffre.applicationEmail, offre.applicationEmail) &&
        posteOf(earlierOffre.title, earlierOffre.workplace) === posteOf(offre.title, offre.workplace),
    )
    .toSorted((left, right) => right.reference.localeCompare(left.reference))[0];
}
