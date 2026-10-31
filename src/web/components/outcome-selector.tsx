import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Status } from '#/web/components/badge.tsx';
import { ButtonRow } from '#/web/components/button-row.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';

import './outcome-selector.css';

// The outcomes of an Application in the order the selector shows them, In progress being Applied
const OUTCOME_LIST = ['applied', 'hired', 'rejected'] as const satisfies Status[];

interface IOutcomeSelector {
  status: Status;
  // What the actions let the Posting move to, besides its Status
  statusChoiceList: Status[];
  error: string | null | undefined;
}

// Applied is never undone and freezes the Chosen Letter, the one sent: once React runs it takes a
// second click, without a browser dialog; before, the confirmation shows at once, so the form also
// posts without JS
function ApplyButton({ error }: Readonly<{ error: string | null | undefined }>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const { t } = useTranslation('posting');
  const isHydrated = useIsHydrated();
  return (
    <ButtonRow>
      {!isHydrated || isConfirming ? (
        <>
          <button type="submit" name="status" value="applied" className="button button--primary">
            {t('confirmApplied')}
          </button>
          {isHydrated && (
            <button
              className="button"
              type="button"
              onClick={() => {
                setIsConfirming(false);
              }}
            >
              {t('cancel')}
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            setIsConfirming(true);
          }}
        >
          {t('markApplied')}
        </button>
      )}
      <p>{t('appliedFreezesLetter')}</p>
      {error != null && <p role="alert">{error}</p>}
    </ButtonRow>
  );
}

// Offers only what the Candidate can choose, inside the form of its Container: Applied on a To Apply
// Posting, then In progress, Hired or Rejected on an Application, its outcome pressed. The step
// shows in the badge beside it (ADR-0009).
export function OutcomeSelector({ status, statusChoiceList, error }: Readonly<IOutcomeSelector>) {
  const { t } = useTranslation('posting');
  if (status === 'to_apply') {
    return statusChoiceList.includes('applied') ? <ApplyButton error={error} /> : null;
  }
  return (
    <ButtonRow>
      <div className="outcome-selector" role="group" aria-label={t('outcomeLabel')}>
        {OUTCOME_LIST.filter((outcome) => outcome === status || statusChoiceList.includes(outcome)).map((outcome) => (
          <button
            className="outcome-selector__option"
            key={outcome}
            type="submit"
            name="status"
            value={outcome}
            aria-pressed={outcome === status}
          >
            {t(`outcomeLabelByStatus.${outcome}`)}
          </button>
        ))}
      </div>
      {error != null && <p role="alert">{error}</p>}
    </ButtonRow>
  );
}
