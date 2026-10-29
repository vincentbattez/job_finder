import type { Offre } from '#/domain/index.ts';

type IComparedOffre = Pick<Offre, 'reference' | 'title' | 'workplace' | 'applicationEmail'>;

// A field as words, whatever its case, accents, hyphens or spacing: « Boulogne sur mer » and
// « Boulogne-sur-mer » are one workplace
function wordListOf(text: string | null): string[] {
  return (text ?? '')
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');
}

// A field left empty is the same as no other
function isSameField(left: string | null, right: string | null): boolean {
  const leftKey = wordListOf(left).join(' ');
  return leftKey !== '' && leftKey === wordListOf(right).join(' ');
}

// The words of one title all appear in the other: a Republication drops or adds some, such as its
// juridiction, but never swaps the service, the only thing telling two Postes of one juridiction
// apart (the Béthune Offres share workplace and mail)
function isTitleClose(left: string, right: string): boolean {
  const leftWordList = wordListOf(left);
  const rightWordList = wordListOf(right);
  return (
    leftWordList.every((word) => rightWordList.includes(word)) ||
    rightWordList.every((word) => leftWordList.includes(word))
  );
}

// The Offre that a new Offre publishes again, among the earlier ones of its Candidat: same
// workplace, same mail de candidature and a close title (spec « Republication »). The latest one
// when the Poste was published several times.
export function findRepublishedOffre<T extends IComparedOffre>(offre: IComparedOffre, offreList: T[]): T | undefined {
  return offreList
    .filter(
      (earlierOffre) =>
        isSameField(earlierOffre.workplace, offre.workplace) &&
        isSameField(earlierOffre.applicationEmail, offre.applicationEmail) &&
        isTitleClose(earlierOffre.title, offre.title),
    )
    .toSorted((left, right) => right.reference.localeCompare(left.reference))[0];
}
