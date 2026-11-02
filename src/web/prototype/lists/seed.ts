// PROTOTYPE. The snapshot has 48 New Postings and 1 To Apply: To Apply could not show what it is for.
// At the first list the prototype opens, six New Postings are kept, silently, in the client store only
// (store.ts `seed`, never the database): those whose Deadline comes first, in six different Cities,
// each with Research / Letter states that show the workflow (a Letter to validate, ready to send…).
import { useEffect } from 'react';

import { daysUntil, type IPosting } from '../model.ts';
import { useActions, usePostings, usePrototype, type ISeedArtifact } from '../store.ts';

const SEED_ARTIFACTS: ISeedArtifact[][] = [
  [
    { artifactKey: 'research', isValidated: true },
    { artifactKey: 'letter', isValidated: false },
  ],
  [
    { artifactKey: 'research', isValidated: true },
    { artifactKey: 'letter', isValidated: true },
  ],
  [{ artifactKey: 'research', isValidated: false }],
  [{ artifactKey: 'research', isValidated: true }],
  [],
  [
    { artifactKey: 'research', isValidated: true },
    { artifactKey: 'letter', isValidated: false },
  ],
];

const seededCandidateIdSet = new Set<string>();

function seedListOf(postings: IPosting[], now: Date): IPosting[] {
  const cityList: string[] = [];
  return postings
    .filter(
      ({ status, archivedAt, deadline, latitude, isSynthetic }) =>
        status === 'new' &&
        archivedAt === null &&
        !isSynthetic &&
        latitude !== null &&
        deadline !== null &&
        daysUntil(deadline, now) >= 0,
    )
    .toSorted((first, second) => (first.deadline ?? '').localeCompare(second.deadline ?? ''))
    .filter(({ city }) => {
      if (city === null || cityList.includes(city)) {
        return false;
      }
      cityList.push(city);
      return true;
    })
    .slice(0, SEED_ARTIFACTS.length);
}

export function useSeedToApply() {
  const postings = usePostings();
  const actions = useActions();
  const { candidate } = usePrototype();
  useEffect(() => {
    if (seededCandidateIdSet.has(candidate.id)) {
      return;
    }
    seededCandidateIdSet.add(candidate.id);
    for (const [index, posting] of seedListOf(postings, new Date()).entries()) {
      actions.seed(posting.reference, { status: 'to_apply', step: 'to_apply' }, SEED_ARTIFACTS[index]);
    }
    // Once per Candidate: the Postings as they were at the first list opened
  }, [candidate.id]);
}
