import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { Actions } from '#/actions/index.ts';

import { StatusBadge } from './badge.tsx';
import { DateText } from './date.tsx';
import { IcalButton } from './ical-button.tsx';

import './application-row.css';

// An Application as the actions give it to its row
export type Application = Awaited<ReturnType<Actions['listApplicationsInProgress']>>[number];

interface IApplicationRow {
  application: Application;
  // The outcome selector, from its Container: a Dumb never imports it (ADR-0008)
  outcomeSelector: ReactNode;
}

// Where an Application stands at a glance, its outcome changed without opening the Posting page; the
// home and /applications share it
export function ApplicationRow({ application, outcomeSelector }: Readonly<IApplicationRow>) {
  const { posting, nextInterview, hasUpcomingInterview, interviewCount, notesExcerpt, lastChangeAt } = application;
  const { t } = useTranslation('posting');
  const titleId = useId();
  const whereList = [posting.employer, posting.city].filter((part) => part !== null);
  return (
    <article className="application-row" aria-labelledby={titleId}>
      <div className="application-row__head">
        <Link id={titleId} className="application-row__title" to={`/postings/${posting.reference}`}>
          {posting.title}
        </Link>
        {whereList.length > 0 && <span className="application-row__where">{whereList.join(' · ')}</span>}
      </div>
      <div className="application-row__status">
        <StatusBadge step={posting.step} isExpired={posting.isExpired} archivedAt={posting.archivedAt} />
        {outcomeSelector}
      </div>
      <dl className="application-row__facts">
        {nextInterview !== null && (
          <>
            <dt>{hasUpcomingInterview ? t('interviews.next') : t('interviews.last')}</dt>
            <dd className="application-row__interview">
              <time dateTime={nextInterview.startAt.toISOString()}>
                {t('dateTime', { ns: 'common', date: nextInterview.startAt })}
              </time>
              {interviewCount > 1 && <span>{t('interviews.count', { count: interviewCount })}</span>}
              <IcalButton reference={posting.reference} number={nextInterview.number} />
            </dd>
          </>
        )}
        <dt>{t('applicationRow.lastChangeAt')}</dt>
        <dd>
          <DateText date={lastChangeAt} />
        </dd>
        {notesExcerpt !== '' && (
          <>
            <dt>{t('applicationRow.notesExcerpt')}</dt>
            <dd className="application-row__notes">{notesExcerpt}</dd>
          </>
        )}
      </dl>
    </article>
  );
}
