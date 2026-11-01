import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Status } from '#/web/components/badge.tsx';
import { ButtonRow } from '#/web/components/button-row.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';

import './outcome-selector.css';

// The outcomes of an Application in the order the selector shows them; back In progress removes the
// outcome rather than being one, so it gets its own button
const OUTCOME_LIST = ['hired', 'rejected'] as const satisfies Status[];

// The two moves that freeze or free the Chosen Letter, each confirmed by a second click
const CONFIRMED_BUTTON_BY_STATUS = {
  applied: { mark: 'markApplied', confirm: 'confirmApplied', note: 'appliedFreezesLetter', isPrimary: true },
  to_apply: { mark: 'markNotSent', confirm: 'confirmToApply', note: 'toApplyFreesLetter', isPrimary: false },
} as const;

interface IOutcomeSelector {
  status: Status;
  // What the actions let the Posting move to, besides its Status
  statusChoiceList: Status[];
  error: string | null | undefined;
}

interface IConfirmedButton {
  status: keyof typeof CONFIRMED_BUTTON_BY_STATUS;
  error?: string | null | undefined;
}

// Applied freezes the Chosen Letter, the one sent, and undoing it frees the Letter: once React runs it
// takes a second click, which shows what it does, without a browser dialog; before, the confirmation
// shows at once, so the form also posts without JS
function ConfirmedButton({ status, error }: Readonly<IConfirmedButton>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const { t } = useTranslation('posting');
  const isHydrated = useIsHydrated();
  const { mark, confirm, note, isPrimary } = CONFIRMED_BUTTON_BY_STATUS[status];
  const className = isPrimary ? 'button button--primary' : 'button';
  return (
    <ButtonRow>
      {!isHydrated || isConfirming ? (
        <>
          <button type="submit" name="status" value={status} className={className}>
            {t(confirm)}
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
          <p>{t(note)}</p>
        </>
      ) : (
        <button
          type="button"
          className={className}
          onClick={() => {
            setIsConfirming(true);
          }}
        >
          {t(mark)}
        </button>
      )}
      {error != null && <p role="alert">{error}</p>}
    </ButtonRow>
  );
}

// Offers only what the Candidate can choose, inside the form of its Container: Applied on a To Apply
// Posting, then Hired or Rejected on an Application, its outcome pressed, back In progress apart once it
// has one, and To Apply again on one In progress whose Letter was never sent. The step shows in the
// badge beside it (ADR-0009).
export function OutcomeSelector({ status, statusChoiceList, error }: Readonly<IOutcomeSelector>) {
  const { t } = useTranslation('posting');
  if (status === 'to_apply') {
    return statusChoiceList.includes('applied') ? <ConfirmedButton status="applied" error={error} /> : null;
  }
  return (
    <>
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
        {statusChoiceList.includes('applied') && (
          <button className="button" type="submit" name="status" value="applied">
            {t('backInProgress')}
          </button>
        )}
        {error != null && <p role="alert">{error}</p>}
      </ButtonRow>
      {statusChoiceList.includes('to_apply') && <ConfirmedButton status="to_apply" />}
    </>
  );
}
