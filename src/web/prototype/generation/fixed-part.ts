// PROTOTYPE · the Fixed Part with its substituted values marked: fixed-part.server.ts composes it with
// each value wrapped in these private-use sentinels; the panel splits on them to highlight what the tool
// filled in for this Posting (reference, title, employer, paths, Interview date, Interviewers, Notes…).
export const MARK_START = '';
export const MARK_END = '';

export interface IFixedPartSegment {
  text: string;
  isSubstituted: boolean;
}

export function segmentsOf(marked: string): IFixedPartSegment[] {
  const segmentList: IFixedPartSegment[] = [];
  let rest = marked;
  while (rest !== '') {
    const start = rest.indexOf(MARK_START);
    const end = start === -1 ? -1 : rest.indexOf(MARK_END, start);
    if (start === -1 || end === -1) {
      segmentList.push({ text: rest, isSubstituted: false });
      break;
    }
    if (start > 0) {
      segmentList.push({ text: rest.slice(0, start), isSubstituted: false });
    }
    segmentList.push({ text: rest.slice(start + MARK_START.length, end), isSubstituted: true });
    rest = rest.slice(end + MARK_END.length);
  }
  return segmentList;
}
