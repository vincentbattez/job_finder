import { CalendarClockIcon, ExternalLinkIcon, MailIcon, RepeatIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Link } from 'react-router';
import remarkGfm from 'remark-gfm';

import type { Step } from './badge.tsx';

interface ILinkedPosting {
  reference: string;
}

// What the Posting tab reads of the Posting, as readPosting gives it
export interface IPostingFacts {
  posting: {
    reference: string;
    url: string | null;
    publishedAt: Date | null;
    deadline: Date | null;
    startDate: Date | null;
    appliedAt: Date | null;
    applicationEmail: string | null;
    contact1: string | null;
    contact2: string | null;
    repostOf: ILinkedPosting | null;
    repostList: ILinkedPosting[];
  };
  jobDescription: string;
  repost: {
    publicationNumber: number;
    firstPublishedAt: Date | null;
    earlierApplication: { reference: string; appliedAt: Date | null; step: Step } | null;
  };
}

// A mail written in free text, as some courts publish it, stays as published rather than a broken link
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

// The titles of the Job Description sit below the heading of its tab, which keeps one h1 per page
const COMPONENT_BY_ELEMENT: Components = { h1: 'h3', h2: 'h3', h3: 'h4', h4: 'h5' };

// GitHub Markdown, as the Sources and the import write it; react-markdown skips raw HTML
const REMARK_PLUGIN_LIST = [remarkGfm];

const LINK_CLASS_NAME = 'text-primary underline-offset-4 hover:underline';

function AsideSection({ title, icon, children }: Readonly<{ title: string; icon: ReactNode; children: ReactNode }>) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card p-4 shadow-whisper">
      <h2 id={headingId} className="mb-2 flex max-w-none items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Fact({ term, children }: Readonly<{ term: string; children: ReactNode }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{term}</dt>
      <dd className="min-w-0 text-right tabular-nums">{children}</dd>
    </div>
  );
}

function DateFact({ term, date }: Readonly<{ term: string; date: Date | null }>) {
  const { t } = useTranslation();
  return (
    <Fact term={term}>
      {date === null ? (
        <span className="text-muted-foreground">{t('missingDate')}</span>
      ) : (
        <time dateTime={date.toISOString()}>{t('date', { date })}</time>
      )}
    </Fact>
  );
}

// The contacts the Job Description gives, the application mail as a link when it is one
export function ContactList({
  applicationEmail,
  contact1,
  contact2,
}: Readonly<Pick<IPostingFacts['posting'], 'applicationEmail' | 'contact1' | 'contact2'>>) {
  const { t } = useTranslation('posting');
  const contactList = [contact1, contact2].filter((contact) => contact !== null);
  if (applicationEmail === null && contactList.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('page.noContact')}</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm">
      {applicationEmail !== null && (
        <li className="truncate">
          {EMAIL_PATTERN.test(applicationEmail) ? (
            <a href={`mailto:${applicationEmail}`} className={LINK_CLASS_NAME}>
              {applicationEmail}
            </a>
          ) : (
            applicationEmail
          )}
        </li>
      )}
      {contactList.map((contact) => (
        <li key={contact} className="text-muted-foreground">
          {contact}
        </li>
      ))}
    </ul>
  );
}

// The Repost of a Position: how often it was published, the Application to an earlier Posting of it,
// and the Postings it publishes again or that publish it again
function RepostSection({ posting, repost }: Readonly<Pick<IPostingFacts, 'posting' | 'repost'>>) {
  const { t } = useTranslation('posting');
  const { publicationNumber, firstPublishedAt, earlierApplication } = repost;
  if (posting.repostOf === null && posting.repostList.length === 0) {
    return null;
  }
  return (
    <AsideSection title={t('page.repostHeading')} icon={<RepeatIcon />}>
      <ul className="space-y-2 text-sm">
        {publicationNumber > 1 && (
          <li>
            {firstPublishedAt === null
              ? t('page.publicationCount', { count: publicationNumber })
              : t('page.publicationCountSince', { count: publicationNumber, date: firstPublishedAt })}
          </li>
        )}
        {earlierApplication !== null && (
          <li className="rounded-lg bg-step-applied/10 px-3 py-2 text-step-applied-foreground">
            <Link to={`/postings/${earlierApplication.reference}`} className="underline-offset-4 hover:underline">
              {earlierApplication.appliedAt === null
                ? t('page.earlierApplicationUndated', {
                    stepLabel: t(`statusLabelByStatus.${earlierApplication.step}`, { ns: 'common' }),
                  })
                : t('page.earlierApplication', {
                    date: earlierApplication.appliedAt,
                    stepLabel: t(`statusLabelByStatus.${earlierApplication.step}`, { ns: 'common' }),
                  })}
            </Link>
          </li>
        )}
        {posting.repostOf !== null && (
          <li>
            <Link to={`/postings/${posting.repostOf.reference}`} className={LINK_CLASS_NAME}>
              {t('page.repostOf', { reference: posting.repostOf.reference })}
            </Link>
          </li>
        )}
        {posting.repostList.map(({ reference }) => (
          <li key={reference}>
            <Link to={`/postings/${reference}`} className={LINK_CLASS_NAME}>
              {t('page.repostedAs', { reference })}
            </Link>
          </li>
        ))}
      </ul>
    </AsideSection>
  );
}

// The Posting tab: the Job Description to read, and beside it what the Candidate checks at a glance;
// children come first in the aside, such as the state of an imported Posting's extraction
export function PostingFacts({
  posting,
  jobDescription,
  repost,
  children,
}: Readonly<IPostingFacts & { children?: ReactNode }>) {
  const { t } = useTranslation('posting');
  const jobDescriptionId = useId();
  return (
    <div className="@container">
      <div className="grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby={jobDescriptionId} className="min-w-0">
          <div className="mx-auto max-w-[72ch]">
            <h2 id={jobDescriptionId} className="mb-4 max-w-none text-label text-muted-foreground uppercase">
              {t('jobDescriptionHeading')}
            </h2>
            <div className="prose max-w-none prose-neutral dark:prose-invert prose-h3:mt-8 prose-h4:mt-5 prose-h4:mb-1 prose-p:my-1.5">
              <ReactMarkdown components={COMPONENT_BY_ELEMENT} remarkPlugins={REMARK_PLUGIN_LIST}>
                {jobDescription}
              </ReactMarkdown>
            </div>
          </div>
        </section>
        <aside className="order-first space-y-4 @4xl:sticky @4xl:top-20 @4xl:order-none @4xl:self-start">
          {children}
          <AsideSection title={t('page.factsHeading')} icon={<CalendarClockIcon />}>
            <dl className="divide-y">
              <DateFact term={t('deadlineTerm')} date={posting.deadline} />
              <DateFact term={t('page.startDateTerm')} date={posting.startDate} />
              <DateFact term={t('publishedAtTerm')} date={posting.publishedAt} />
              {posting.appliedAt !== null && <DateFact term={t('page.appliedAtTerm')} date={posting.appliedAt} />}
              <Fact term={t('referenceTerm')}>
                {posting.url === null ? (
                  posting.reference
                ) : (
                  <a
                    href={posting.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1 ${LINK_CLASS_NAME}`}
                  >
                    {posting.reference}
                    <ExternalLinkIcon className="size-3" />
                  </a>
                )}
              </Fact>
            </dl>
          </AsideSection>
          <AsideSection title={t('contactsHeading')} icon={<MailIcon />}>
            <ContactList {...posting} />
          </AsideSection>
          <RepostSection posting={posting} repost={repost} />
        </aside>
      </div>
    </div>
  );
}
