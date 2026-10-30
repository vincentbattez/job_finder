import { useId, type ReactNode } from 'react';

import { ARTIFACT_LABEL_BY_ARTIFACT } from '#/actions/labels.ts';

import { StateBadge, StatusBadge, type State } from './badge.tsx';
import { DateText } from './date.tsx';
import { Markdown } from './markdown.tsx';
import type { IPostingRow } from './posting-list.tsx';
import { Recipients, type IRecipients } from './recipients.tsx';
import { RepostFacts, type IRepost } from './repost.tsx';

type Artifact = 'research' | 'letter' | 'interview_brief' | 'visualization';

type VersionState = 'running' | 'ready' | 'failed';

export const STATE_BY_VERSION_STATE: Record<VersionState, State> = {
  running: 'in_progress',
  ready: 'ready',
  failed: 'failed',
};

export interface IArtifactVersions {
  artifact: Artifact;
  state: State;
  // The module that produces the Artifact, and why it cannot run now
  module: { refusal: string | null };
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

const NON_PRECISE = <span className="missing">Non précisé</span>;

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
            <StatusBadge status={posting.status} isExpired={posting.isExpired} />
          </div>
          <p>{[posting.workplace, posting.employer].filter(Boolean).join(', ')}</p>
          <dl className="posting-detail__facts">
            <div>
              <dt>Référence</dt>
              <dd className="reference">
                {posting.url === null ? posting.reference : <a href={posting.url}>{posting.reference}</a>}
              </dd>
            </div>
            <div>
              <dt>Publiée le</dt>
              <dd className="date">
                <DateText date={posting.publishedAt} />
              </dd>
            </div>
            <div>
              <dt>Date limite</dt>
              <dd className="date">
                <DateText date={posting.deadline} />
              </dd>
            </div>
            <RepostFacts posting={posting} />
          </dl>
          {children}
        </header>
        <section className="posting-detail__part" aria-labelledby={artifactsId}>
          <PART_TAG id={artifactsId}>Artefacts</PART_TAG>
          <ul className="artifact-list">
            {artifactList.map(({ artifact, state }) => (
              <li key={artifact} data-artifact={artifact}>
                <a href={`#${artifact}`}>{ARTIFACT_LABEL_BY_ARTIFACT[artifact]}</a>
                <StateBadge state={state} />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="posting-detail__column">
        <section className="posting-detail__part" aria-labelledby={contactsId}>
          <PART_TAG id={contactsId}>Contacts</PART_TAG>
          <dl className="posting-detail__contacts">
            <div>
              <dt>Mail de candidature</dt>
              <dd>
                {posting.applicationEmail !== null && EMAIL_PATTERN.test(posting.applicationEmail) ? (
                  <a href={`mailto:${posting.applicationEmail}`}>{posting.applicationEmail}</a>
                ) : (
                  (posting.applicationEmail ?? NON_PRECISE)
                )}
              </dd>
            </div>
            <div>
              <dt>Contact 1</dt>
              <dd>{posting.contact1 ?? NON_PRECISE}</dd>
            </div>
            <div>
              <dt>Contact 2</dt>
              <dd>{posting.contact2 ?? NON_PRECISE}</dd>
            </div>
          </dl>
        </section>
        <section className="posting-detail__part" aria-labelledby={recipientsId}>
          <PART_TAG id={recipientsId}>Destinataires recommandés</PART_TAG>
          {recipients === null ? (
            <p className="missing">La Lettre les recommande, une fois produite.</p>
          ) : (
            <Recipients recipients={recipients} />
          )}
        </section>
        <section className="posting-detail__part" aria-labelledby={jobDescriptionId}>
          <PART_TAG id={jobDescriptionId}>Fiche de poste</PART_TAG>
          <details className="posting-detail__job-description">
            <summary>Lire la Fiche de poste</summary>
            <Markdown markdown={jobDescription} />
          </details>
        </section>
      </div>
    </article>
  );
}
