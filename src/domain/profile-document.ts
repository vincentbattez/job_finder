// A document of the Profile, told apart by its name (spec #125): any other name is an Annex. Without zod,
// so the front's bundle may import it.
type ProfileDocumentKind = 'annex' | 'cv' | 'facts' | 'past_letter';

export function profileDocumentKindOf(fileName: string): ProfileDocumentKind {
  if (fileName === 'cv.md') {
    return 'cv';
  }
  if (fileName === 'facts.md') {
    return 'facts';
  }
  return /^letter-.*\.md$/u.test(fileName) ? 'past_letter' : 'annex';
}
