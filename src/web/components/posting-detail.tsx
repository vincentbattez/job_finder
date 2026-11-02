import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Artifact, ErrorCode } from '#/actions/index.ts';

import { StateBadge, StatusBadge, type State } from './badge.tsx';
import { DateText } from './date.tsx';
import { Markdown } from './markdown.tsx';
import type { IPostingRow } from './posting-list.tsx';
import { Recipients, type IRecipients } from './recipients.tsx';
import { RepostFacts, type IRepost } from './repost.tsx';

import './posting-detail.css';

type VersionState = 'running' | 'ready' | 'failed';

export const STATE_BY_VERSION_STATE: Record<VersionState, State> = {
  running: 'in_progress',
  ready: 'ready',
  failed: 'failed',
};

// Its Fixed Part and its Instructions as raw text, and the Chosen Versions it reads, of this Posting or
// of another one
export interface IPrompt {
  fixedPart: string;
  instructions: string;
  readVersionList: { reference: string; artifact: Artifact; interviewNumber: number | null; number: number }[];
}

export interface IArtifactVersions {
  artifact: Artifact;
  state: State;
  // Why its last job failed: the code and the log, which starts with the code's message
  failure: { errorCode: ErrorCode | null; log: string } | null;
  // Why the notification of its last job, such as « Research ready », was not sent
  notificationFailure: { errorCode: ErrorCode; message: string } | null;
  // Why its last job, queued or running, does not move: the worker is stopped or stuck
  workerFailure: { errorCode: ErrorCode; message: string } | null;
  // The module that produces the Artifact, and why it cannot run now; else the Prompt a run started now
  // would receive
  module: { refusal: string | null; prompt: IPrompt | null };
  // Given by the action: jf edit opens its Chosen Version
  isEditable: boolean;
  versionList: {
    version: {
      number: number;
      state: VersionState;
      isChosen: boolean;
      hasCandidateInstructions: boolean;
      instructions: string;
      createdAt: Date;
    };
    isChoosable: boolean;
    documentList: { fileName: string; markdown: string; isModifiable: boolean }[];
  }[];
}

// The shape of the readPosting action, so the route passes its result as is
export interface IPostingDetail {
  posting: IPostingRow & {
    employer: string | null;
    applicationEmail: string | null;
    contact1: string | null;
    contact2: string | null;
    repostOf: IRepost['repostOf'];
    repostList: IRepost['repostList'];
  };
  jobDescription: string;
  artifactList: IArtifactVersions[];
  recipients: IRecipients | null;
}

// A mail written in free text, as Avesnes publishes it, stays as published rather than a broken link
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

// A page of its own, or a sample on /design; the Job Description is folded, long as published
export function PostingDetail({
  detail,
  isPage = false,
  children,
}: Readonly<{ detail: IPostingDetail; isPage?: boolean; children?: ReactNode }>) {
  const { posting, jobDescription, artifactList, recipients } = detail;
  const TITLE_TAG = isPage ? 'h1' : 'h3';
  const PART_TAG = isPage ? 'h2' : 'h4';
  const { t } = useTranslation('posting');
  const missingContact = <span className="posting-detail__missing">{t('missingContact')}</span>;
  const artifactsId = useId();
  const contactsId = useId();
  const recipientsId = useId();
  const jobDescriptionId = useId();
  return (
    <article className="posting-detail">
      <div className="posting-detail__column">
        <header className="posting-detail__label">
          <div className="posting-detail__title">
            <TITLE_TAG>{posting.title}</TITLE_TAG>
            <StatusBadge {...posting} />
          </div>
          <p>{[posting.workplace, posting.employer].filter(Boolean).join(', ')}</p>
          <dl className="posting-detail__facts">
            <div>
              <dt>{t('referenceTerm')}</dt>
              <dd className="posting-detail__reference">
                {posting.url === null ? posting.reference : <a href={posting.url}>{posting.reference}</a>}
              </dd>
            </div>
            <div>
              <dt>{t('publishedAtTerm')}</dt>
              <dd className="posting-detail__date">
                <DateText date={posting.publishedAt} />
              </dd>
            </div>
            <div>
              <dt>{t('deadlineTerm')}</dt>
              <dd className="posting-detail__date">
                <DateText date={posting.deadline} />
              </dd>
            </div>
            <RepostFacts posting={posting} />
          </dl>
          {children}
        </header>
        <section className="posting-detail__part" aria-labelledby={artifactsId}>
          <PART_TAG className="posting-detail__heading" id={artifactsId}>
            {t('artifactsHeading')}
          </PART_TAG>
          <ul className="posting-detail__compartments">
            {artifactList.map(({ artifact, state }) => (
              <li key={artifact} className="posting-detail__compartment" data-artifact={artifact}>
                <a href={`#${artifact}`}>{t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' })}</a>
                <StateBadge state={state} />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="posting-detail__column">
        <section className="posting-detail__part" aria-labelledby={contactsId}>
          <PART_TAG className="posting-detail__heading" id={contactsId}>
            {t('contactsHeading')}
          </PART_TAG>
          <dl className="posting-detail__contacts">
            <div>
              <dt>{t('contactLabelByField.applicationEmail')}</dt>
              <dd>
                {posting.applicationEmail !== null && EMAIL_PATTERN.test(posting.applicationEmail) ? (
                  <a href={`mailto:${posting.applicationEmail}`}>{posting.applicationEmail}</a>
                ) : (
                  (posting.applicationEmail ?? missingContact)
                )}
              </dd>
            </div>
            <div>
              <dt>{t('contactLabelByField.contact1')}</dt>
              <dd>{posting.contact1 ?? missingContact}</dd>
            </div>
            <div>
              <dt>{t('contactLabelByField.contact2')}</dt>
              <dd>{posting.contact2 ?? missingContact}</dd>
            </div>
          </dl>
        </section>
        <section className="posting-detail__part" aria-labelledby={recipientsId}>
          <PART_TAG className="posting-detail__heading" id={recipientsId}>
            {t('recipientsHeading')}
          </PART_TAG>
          {recipients === null ? (
            <p className="posting-detail__missing">{t('noRecipients')}</p>
          ) : (
            <Recipients recipients={recipients} />
          )}
        </section>
        <section className="posting-detail__part" aria-labelledby={jobDescriptionId}>
          <PART_TAG className="posting-detail__heading" id={jobDescriptionId}>
            {t('jobDescriptionHeading')}
          </PART_TAG>
          <details className="posting-detail__job-description">
            <summary>{t('readJobDescription')}</summary>
            <Markdown markdown={jobDescription} />
          </details>
        </section>
      </div>
    </article>
  );
}
