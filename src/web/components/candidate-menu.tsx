import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import './candidate-menu.css';

interface ICandidate {
  id: string;
  name: string;
}

// A plain form, so the choice also works before React hydrates the page; a refusal shows beside it
export function CandidateMenu({
  candidateList,
  candidate,
}: Readonly<{ candidateList: ICandidate[]; candidate: ICandidate | null }>) {
  const { t } = useTranslation('settings');
  const fetcher = useFetcher<{ error?: string }>();
  return (
    <fetcher.Form method="post" action="/candidate" className="candidate-menu">
      <label htmlFor="candidate">{t('menu.candidateLabel')}</label>
      <select
        className="button candidate-menu__select"
        id="candidate"
        name="candidateId"
        key={candidate?.id}
        defaultValue={candidate?.id ?? ''}
      >
        {candidate === null && (
          <option value="" disabled>
            {t('menu.namePlaceholder')}
          </option>
        )}
        {candidateList.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <button className="button button--primary" type="submit">
        {t('menu.choose')}
      </button>
      {fetcher.data?.error !== undefined && <p role="alert">{fetcher.data.error}</p>}
    </fetcher.Form>
  );
}
