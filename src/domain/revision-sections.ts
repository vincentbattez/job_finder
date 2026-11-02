// A section of a Revision as the Candidate left it (GLOSSARY.md « Revision », « Mastered »)
export interface IRevisionSection {
  title: string;
  note: string;
  isMastered: boolean;
}

function isKept({ note, isMastered }: IRevisionSection): boolean {
  return isMastered || note.trim() !== '';
}

// The sections of the Chosen Interview Brief, in its order, each with what the Candidate left under its
// title, and apart, the sections a newer Chosen Version no longer has that still hold a note or a Mastered
// mark (spec #125, « Reading and Revision »). Without zod, so the front's bundle may import it.
export function sortRevision(
  titleList: readonly string[],
  savedList: readonly IRevisionSection[],
): { sectionList: IRevisionSection[]; vanishedList: IRevisionSection[] } {
  const titleSet = new Set(titleList);
  return {
    sectionList: titleList.map(
      (title) => savedList.find((saved) => saved.title === title) ?? { title, note: '', isMastered: false },
    ),
    vanishedList: savedList.filter((saved) => !titleSet.has(saved.title) && isKept(saved)),
  };
}
