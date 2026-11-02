// Private-use characters around each value a composer substitutes in its Fixed Part, which the generation
// panel highlights; the run's Fixed Part carries none (spec #125). Without zod, so the front's bundle may
// import it.
export const MARK_START = '';
export const MARK_END = '';

export interface ISubstitutionSegment {
  text: string;
  isSubstituted: boolean;
}

// A marked Fixed Part cut into its plain text and the values the tool substituted, in order
export function segmentsOf(marked: string): ISubstitutionSegment[] {
  return marked
    .split(MARK_START)
    .flatMap((chunk, index): ISubstitutionSegment[] => {
      if (index === 0) {
        return [{ text: chunk, isSubstituted: false }];
      }
      const end = chunk.indexOf(MARK_END);
      return [
        { text: chunk.slice(0, end), isSubstituted: true },
        { text: chunk.slice(end + MARK_END.length), isSubstituted: false },
      ];
    })
    .filter(({ text }) => text !== '');
}
