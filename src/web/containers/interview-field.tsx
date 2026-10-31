// The Interview an Artifact is attached to, posted with each of its forms; none for an Artifact of the Posting
export function InterviewField({ interviewNumber }: Readonly<{ interviewNumber: number | null }>) {
  return interviewNumber === null ? null : <input type="hidden" name="interview" value={interviewNumber} />;
}
