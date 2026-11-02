import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { CandidateSwitcher as CandidateSwitcherView } from '#/web/components/candidate-switcher.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

interface ICandidate {
  id: string;
  name: string;
}

// The switch posts to /candidate, which remembers the Candidate and brings back the same page, or New
// from a Posting page, whose Posting belongs to the Candidate left (routes/candidate.ts)
export function CandidateSwitcher({
  candidateList,
  candidate,
}: Readonly<{ candidateList: ICandidate[]; candidate: ICandidate | null }>) {
  const { t } = useTranslation('shell');
  const fetcher = useFetcher<IRefusal>();
  useFeedback(fetcher, () => t('candidate.switched', { candidateName: candidate?.name ?? '' }));
  return (
    <CandidateSwitcherView
      candidateList={candidateList}
      candidate={candidate}
      isPending={fetcher.state !== 'idle'}
      onSwitch={(candidateId) => {
        void fetcher.submit({ candidateId }, { method: 'post', action: '/candidate' });
      }}
    />
  );
}
