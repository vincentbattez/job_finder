// The anchor of the section of an Artifact of an Interview on the Posting page, which the iCal file of
// the Interview links to; without zod, so the front's bundle may import it
export function interviewSectionIdOf(interviewNumber: number, artifact: string): string {
  return `interview-${String(interviewNumber)}-${artifact}`;
}

// The anchor of an Interview on the Posting page, which its iCal file links to
export function interviewIdOf(interviewNumber: number): string {
  return `interview-${String(interviewNumber)}`;
}
