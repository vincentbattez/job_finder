import { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoaderData, useSearchParams, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { interviewIdOf, interviewSectionIdOf } from '#/actions/interview-section.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { PageHeader } from '#/web/components/page-header.tsx';
import { PostingFacts } from '#/web/components/posting-facts.tsx';
import { POSTING_TAB_LIST, PostingTabs, type PostingTab } from '#/web/components/posting-tabs.tsx';
import { Recipients } from '#/web/components/recipients.tsx';
import { StepBadge } from '#/web/components/step-badge.tsx';
import { ArtifactVersions } from '#/web/containers/artifact-versions.tsx';
import { ExtractionLaunch } from '#/web/containers/extraction-launch.tsx';
import { Interviews } from '#/web/containers/interviews.tsx';
import { Notes } from '#/web/containers/notes.tsx';
import { PostingActions } from '#/web/containers/posting-actions.tsx';
import { relayLoader } from '#/web/relay-action.server.ts';

const MINUTE_MS = 60_000;

export function loader({ params, request }: LoaderFunctionArgs) {
  return relayLoader(request, async () => {
    const [{ candidate, locale }, detail] = await Promise.all([
      readCandidate(request),
      ACTIONS.readPosting({ reference: params.reference }),
    ]);
    return { candidate, locale, detail };
  });
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  const t = tFor(localeOf(loaderData), 'posting');
  return [{ title: t('pageTitle', { postingTitle: loaderData?.detail.posting.title ?? t('unreadPosting') }) }];
}

function isPostingTab(value: string | null): value is PostingTab {
  return POSTING_TAB_LIST.some((tab) => tab === value);
}

// The Posting page (spec #125, « The Posting page »): its header with one primary action by Step, then
// its tabs. The URL holds the tab, the Interview and the document, so a link or Back opens them again.
export default function Posting() {
  const { detail } = useLoaderData<typeof loader>();
  const { posting, interviewList } = detail;
  const { t } = useTranslation('posting');
  const recipientsId = useId();
  const [searchParameters, setSearchParameters] = useSearchParams();
  const requestedTab = searchParameters.get('tab');
  const tab = isPostingTab(requestedTab) ? requestedTab : 'posting';
  const interviewNumber = Number(searchParameters.get('interview'));
  const document = searchParameters.get('doc');

  // The Interview a deep link names, and its document, scrolled into view once the tab shows them
  useEffect(() => {
    if (tab !== 'interviews' || !Number.isSafeInteger(interviewNumber) || interviewNumber < 1) {
      return;
    }
    const id = document === null ? interviewIdOf(interviewNumber) : interviewSectionIdOf(interviewNumber, document);
    globalThis.document.querySelector(`#${id}`)?.scrollIntoView({ block: 'start' });
  }, [tab, interviewNumber, document]);

  const changeTab = (nextTab: string) => {
    setSearchParameters(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('tab', nextTab);
        if (nextTab !== 'interviews') {
          next.delete('interview');
          next.delete('doc');
        }
        return next;
      },
      { preventScrollReset: true },
    );
  };

  const artifactOf = (artifact: string) => detail.artifactList.find((entry) => entry.artifact === artifact);
  const research = artifactOf('research');
  const letter = artifactOf('letter');
  const now = Date.now();
  const nextInterview =
    interviewList.find(({ startAt, durationMinutes }) => startAt.getTime() + durationMinutes * MINUTE_MS > now) ??
    interviewList.at(-1);
  const description = [
    posting.employer,
    posting.city,
    posting.deadline === null ? null : t('page.deadline', { date: posting.deadline }),
  ]
    .filter((part) => part !== null)
    .join(' · ');

  function renderPanel() {
    switch (tab) {
      case 'posting': {
        return (
          <PostingFacts posting={posting} jobDescription={detail.jobDescription} repost={detail.repost}>
            {detail.extraction !== null && <ExtractionLaunch reference={posting.reference} {...detail.extraction} />}
          </PostingFacts>
        );
      }
      case 'research': {
        return research === undefined ? null : <ArtifactVersions reference={posting.reference} {...research} />;
      }
      case 'letter': {
        return (
          <div className="space-y-6">
            {detail.recipients !== null && (
              <section aria-labelledby={recipientsId} className="space-y-3">
                <h2 id={recipientsId} className="max-w-none text-label text-muted-foreground uppercase">
                  {t('recipientsHeading')}
                </h2>
                <Recipients recipients={detail.recipients} />
              </section>
            )}
            {letter !== undefined && <ArtifactVersions reference={posting.reference} {...letter} />}
          </div>
        );
      }
      case 'interviews': {
        return (
          <Interviews
            reference={posting.reference}
            posting={posting}
            hasApplication={detail.hasApplication}
            interviewList={interviewList}
          />
        );
      }
      case 'notes': {
        return <Notes reference={posting.reference} notes={posting.notes} />;
      }
    }
  }

  return (
    <main>
      <PageHeader
        title={posting.title}
        description={description}
        actions={
          <>
            <StepBadge step={posting.step} isArchived={posting.archivedAt !== null} className="hidden sm:inline-flex" />
            <PostingActions
              reference={posting.reference}
              step={posting.step}
              isArchived={posting.archivedAt !== null}
              statusChoiceList={detail.statusChoiceList}
              url={posting.url}
              repostOf={posting.repostOf}
              nextInterviewNumber={nextInterview?.number ?? null}
            />
          </>
        }
      />
      <div className="mx-auto w-full max-w-[96rem] px-4 pt-3 pb-24 sm:px-6 lg:px-8">
        <PostingTabs
          tab={tab}
          onTabChange={changeTab}
          stateByTab={{ research: research?.state, letter: letter?.state }}
          interviewCount={interviewList.length}
        >
          {renderPanel()}
        </PostingTabs>
      </div>
    </main>
  );
}
