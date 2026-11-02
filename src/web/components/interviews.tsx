import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import { DEFAULT_DURATION_MINUTES } from '#/actions/interview-duration.ts';
import { interviewIdOf } from '#/actions/interview-section.ts';
import { parisDateTimeOf } from '#/actions/paris-time.ts';

import { ButtonRow } from './button-row.tsx';
import { Deletion } from './deletion.tsx';
import { IcalButton } from './ical-button.tsx';

import './interviews.css';

// An Interview as the actions give it to the Posting page, its start an instant read in Paris time; its
// Artifacts are laid out by its Container
type Interview = Omit<Awaited<ReturnType<Actions['readPosting']>>['interviewList'][number], 'artifactList'>;

// The form of the section its Container posts, under a key telling it apart; it lays out the fields
// with the refusal of the action, if any
type FormRenderer = (formKey: string, renderFieldList: (error: string | null | undefined) => ReactNode) => ReactNode;

// The Artifacts of an Interview, such as its Interview Brief, which its Container lays out
type ArtifactsRenderer = (interviewNumber: number) => ReactNode;

// Where an Interview most often takes place: the place of work, then its City when it does not name it
function defaultPlaceOf({ workplace, city }: Readonly<{ workplace: string | null; city: string | null }>): string {
  const hasCity = city !== null && !(workplace ?? '').toLowerCase().includes(city.toLowerCase());
  return [workplace, hasCity ? city : null].filter((part) => part !== null && part !== '').join(', ');
}

function InterviewFields({
  intent,
  interview,
  defaultPlace,
  error,
}: Readonly<{
  intent: 'add' | 'edit';
  interview: Interview | null;
  defaultPlace: string;
  error: string | null | undefined;
}>) {
  const { t } = useTranslation('posting');
  return (
    <>
      {interview !== null && <input type="hidden" name="number" value={interview.number} />}
      <div className="interviews__fields">
        <label className="field">
          {t('interviews.start')}
          <input
            type="datetime-local"
            name="start"
            placeholder={t('interviews.startPlaceholder')}
            required
            defaultValue={interview === null ? '' : parisDateTimeOf(interview.startAt)}
          />
        </label>
        <label className="field">
          {t('interviews.duration')}
          <input
            type="number"
            name="durationMinutes"
            placeholder={String(DEFAULT_DURATION_MINUTES)}
            min={1}
            required
            defaultValue={interview?.durationMinutes ?? DEFAULT_DURATION_MINUTES}
          />
        </label>
        <label className="field interviews__wide">
          {t('interviews.place')}
          <input
            type="text"
            name="place"
            placeholder={t('interviews.placePlaceholder')}
            defaultValue={interview?.place ?? defaultPlace}
          />
        </label>
        <label className="field interviews__wide">
          {t('interviews.interviewers')}
          <textarea
            name="interviewers"
            rows={3}
            placeholder={t('interviews.interviewersPlaceholder')}
            defaultValue={interview?.interviewers ?? ''}
          />
        </label>
      </div>
      <ButtonRow>
        <button type="submit" name="intent" value={intent} className="button button--primary">
          {intent === 'add' ? t('interviews.add') : t('interviews.save')}
        </button>
        {error != null && <p role="alert">{error}</p>}
      </ButtonRow>
    </>
  );
}

function InterviewItem({
  reference,
  interview,
  renderForm,
  renderArtifacts,
}: Readonly<{
  reference: string;
  interview: Interview;
  renderForm: FormRenderer;
  renderArtifacts: ArtifactsRenderer;
}>) {
  const headingId = useId();
  const { t } = useTranslation('posting');
  const { number, startAt, durationMinutes, place, interviewers, editCount } = interview;
  return (
    <li>
      <article className="interviews__item" id={interviewIdOf(number)} aria-labelledby={headingId}>
        <h3 id={headingId}>{t('interviews.title', { number })}</h3>
        <dl className="interviews__facts">
          <dt>{t('interviews.start')}</dt>
          <dd>
            <time dateTime={startAt.toISOString()}>{t('dateTime', { ns: 'common', date: startAt })}</time>
          </dd>
          <dt>{t('interviews.duration')}</dt>
          <dd>{t('interviews.minutes', { minutes: durationMinutes })}</dd>
          <dt>{t('interviews.place')}</dt>
          <dd>{place === '' ? '—' : place}</dd>
          <dt>{t('interviews.interviewers')}</dt>
          <dd className="interviews__interviewers">{interviewers === '' ? '—' : interviewers}</dd>
        </dl>
        <IcalButton reference={reference} number={number} />
        <details className="interviews__edit">
          <summary>{t('interviews.edit', { number })}</summary>
          {/* Keyed by its edits, so a saved edit shows the saved values */}
          {renderForm(`edit-${String(number)}-${String(editCount)}`, (error) => (
            <InterviewFields intent="edit" interview={interview} defaultPlace="" error={error} />
          ))}
        </details>
        <Deletion summary={`${t('interviews.delete', { number })}…`}>
          {renderForm(`delete-${String(number)}`, (error) => (
            <ButtonRow>
              <input type="hidden" name="number" value={number} />
              <button type="submit" name="intent" value="delete" className="button button--danger">
                {t('interviews.deleteForGood', { number })}
              </button>
              {error != null && <p role="alert">{error}</p>}
            </ButtonRow>
          ))}
        </Deletion>
        {renderArtifacts(number)}
      </article>
    </li>
  );
}

// The Interviews of an Application, by date, each edited and deleted in place with the Artifacts that
// prepare it, and the form adding the next one; a To Apply Posting has none (ADR-0009)
export function Interviews({
  posting,
  hasApplication,
  interviewList,
  renderForm,
  renderArtifacts,
}: Readonly<{
  posting: { reference: string; workplace: string | null; city: string | null };
  hasApplication: boolean;
  interviewList: Interview[];
  renderForm: FormRenderer;
  renderArtifacts: ArtifactsRenderer;
}>) {
  const headingId = useId();
  const newHeadingId = useId();
  const { t } = useTranslation('posting');
  return (
    <section className="interviews" id="interviews" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('interviews.heading')}</h2>
      {hasApplication ? (
        <>
          {interviewList.length === 0 ? (
            <p className="interviews__empty">{t('interviews.noInterview')}</p>
          ) : (
            <ol className="interviews__list">
              {interviewList.map((interview) => (
                <InterviewItem
                  key={interview.number}
                  reference={posting.reference}
                  interview={interview}
                  renderForm={renderForm}
                  renderArtifacts={renderArtifacts}
                />
              ))}
            </ol>
          )}
          <div className="interviews__new" role="group" aria-labelledby={newHeadingId}>
            <h3 id={newHeadingId}>{t('interviews.newInterview')}</h3>
            {/* Keyed by the count, so the form empties once the Interview is added */}
            {renderForm(`add-${String(interviewList.length)}`, (error) => (
              <InterviewFields intent="add" interview={null} defaultPlace={defaultPlaceOf(posting)} error={error} />
            ))}
          </div>
        </>
      ) : (
        <p className="interviews__empty">{t('interviews.applyFirst')}</p>
      )}
    </section>
  );
}
