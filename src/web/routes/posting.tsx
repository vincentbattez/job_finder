import { useTranslation } from 'react-i18next';
import { useLoaderData, useSearchParams, type LoaderFunctionArgs, type MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { hasTakenPlace } from '#/actions/interview-time.ts';
import { ACTIONS } from '#/web/acl/actions.server.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { summaryOf, type IArtifactVersions } from '#/web/components/artifact.ts';
import { PageHeader } from '#/web/components/page-header.tsx';
import { PostingFacts } from '#/web/components/posting-facts.tsx';
import { POSTING_TAB_LIST, PostingTabs, type PostingTab, type TabSummary } from '#/web/components/posting-tabs.tsx';
import { StepBadge } from '#/web/components/step-badge.tsx';
import { ArtifactView } from '#/web/containers/artifact-view.tsx';
import { Documents } from '#/web/containers/documents.tsx';
import { ExtractionLaunch } from '#/web/containers/extraction-launch.tsx';
import { Interviews } from '#/web/containers/interviews.tsx';
import { Notes } from '#/web/containers/notes.tsx';
import { PostingActions } from '#/web/containers/posting-actions.tsx';
import { relayLoader } from '#/web/relay-action.server.ts';


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

// A generation under way, else the latest Version's validation (spec #125, « IArtifact »)
function tabSummaryOf(artifact: IArtifactVersions | undefined): TabSummary | undefined {
  if (artifact === undefined) {
    return undefined;
  }
  return artifact.state === 'queued' || artifact.state === 'in_progress' ? 'pending' : summaryOf(artifact);
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
  const [searchParameters, setSearchParameters] = useSearchParams();
  const requestedTab = searchParameters.get('tab');
  const tab = isPostingTab(requestedTab) ? requestedTab : 'posting';

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
  const letterList = letter?.versionList ?? [];
  const latestLetter = letterList.findLast(({ version }) => version.state === 'ready');
  const now = new Date();
  const nextInterview =
    interviewList.find((interview) => !hasTakenPlace(interview, now)) ??
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
          <PostingFacts
            posting={posting}
            jobDescription={detail.jobDescription}
            repost={detail.repost}
            documents={<Documents reference={posting.reference} customArtifactList={detail.customArtifactList} />}
          >
            {detail.extraction !== null && <ExtractionLaunch reference={posting.reference} {...detail.extraction} />}
          </PostingFacts>
        );
      }
      case 'research': {
        return research === undefined ? null : (
          <ArtifactView reference={posting.reference} title={posting.title} {...research} />
        );
      }
      case 'letter': {
        return letter === undefined ? null : (
          <ArtifactView
            reference={posting.reference}
            title={posting.title}
            recipients={detail.recipients}
            {...letter}
          />
        );
      }
      case 'interviews': {
        return <Interviews posting={posting} hasApplication={detail.hasApplication} interviewList={interviewList} />;
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
              posting={posting}
              letter={{
                draftNumber:
                  latestLetter?.version.validation === 'draft' && latestLetter.isValidatable
                    ? latestLetter.version.number
                    : null,
                hasChosen: letterList.some(({ version }) => version.isChosen),
              }}
            />
          </>
        }
      />
      <div className="mx-auto w-full max-w-[96rem] px-4 pt-3 pb-24 sm:px-6 lg:px-8">
        <PostingTabs
          tab={tab}
          onTabChange={changeTab}
          stateByTab={{ research: tabSummaryOf(research), letter: tabSummaryOf(letter) }}
          interviewCount={interviewList.length}
        >
          {renderPanel()}
        </PostingTabs>
      </div>
    </main>
  );
}
