import { useTranslation } from 'react-i18next';

import './candidate-menu.css';

interface ICandidate {
  id: string;
  name: string;
}

// The choice of the Candidate who reads, inside the form of its Container; a refusal shows beside it
export function CandidateMenu({
  candidateList,
  candidate,
  error,
}: Readonly<{ candidateList: ICandidate[]; candidate: ICandidate | null; error: string | null | undefined }>) {
  const { t } = useTranslation('settings');
  return (
    <div className="candidate-menu">
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
      {error !== undefined && <p role="alert">{error}</p>}
    </div>
  );
}
