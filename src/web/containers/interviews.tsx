import { CalendarPlusIcon, DownloadIcon, GraduationCapIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useFetcher, useSearchParams } from 'react-router';

import { hasTakenPlace } from '#/actions/interview-time.ts';
import { summaryOf, type IArtifactVersions } from '#/web/components/artifact.ts';
import {
  INTERVIEW_DOCUMENT_LIST,
  InterviewList,
  InterviewsEmpty,
  InterviewSummary,
  revisionPathOf,
  type IInterview,
  type InterviewDocument,
} from '#/web/components/interviews.tsx';
import { StateDot, StateLabel, type TabSummary } from '#/web/components/posting-tabs.tsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/web/components/ui/alert-dialog.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Tabs, TabsList, TabsTrigger } from '#/web/components/ui/tabs.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { ArtifactView } from './artifact-view.tsx';
import { icalHrefOf, InterviewDialog, type IInterviewPosting } from './interview-dialog.tsx';
import { useFeedback } from './use-feedback.ts';

type InterviewDetail = IInterview & { artifactList: IArtifactVersions[] };

function isInterviewDocument(value: string | null): value is InterviewDocument {
  return INTERVIEW_DOCUMENT_LIST.some((document) => document === value);
}

// The Interview the URL names, else the next one to come, else the last one
function selectedOf(interviewList: InterviewDetail[], requested: number, now: number): InterviewDetail | undefined {
  return (
    interviewList.find(({ number }) => number === requested) ??
    interviewList.find((interview) => !hasTakenPlace(interview, new Date(now))) ??
    interviewList.at(-1)
  );
}

// A generation under way, else the latest Version's validation, as the Posting page's tabs tell it
function tabSummaryOf(artifact: IArtifactVersions | undefined): TabSummary {
  if (artifact === undefined) {
    return 'none';
  }
  return artifact.state === 'queued' || artifact.state === 'in_progress' ? 'pending' : summaryOf(artifact);
}

// The Interviews tab (spec #125, « Interviews »): the Interviews by date on the left, the selected one on the
// right with its Interview Brief and Portrait as tabs, each an Artifact view. The URL holds the Interview
// and the document (?interview=<n>&doc=portrait); adding and editing go through the Interview Dialog,
// deleting through an AlertDialog. Only an Application has Interviews (ADR-0009).
export function Interviews({
  posting,
  hasApplication,
  interviewList,
}: Readonly<{ posting: IInterviewPosting; hasApplication: boolean; interviewList: InterviewDetail[] }>) {
  const { t } = useTranslation('posting');
  const [searchParameters, setSearchParameters] = useSearchParams();
  const [dialog, setDialog] = useState<{ isOpen: boolean; interview: IInterview | null }>({
    isOpen: false,
    interview: null,
  });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const removalFetcher = useFetcher<IRefusal>();
  const deleted = useRef({ number: 0 });
  useFeedback(removalFetcher, () => t('interviews.deletedToast', { number: deleted.current.number }));
  const now = Date.now();
  const selected = selectedOf(interviewList, Number(searchParameters.get('interview')), now);
  const requestedDocument = searchParameters.get('doc');
  const document: InterviewDocument = isInterviewDocument(requestedDocument) ? requestedDocument : 'interview_brief';

  const searchOf = (patch: { interview?: number; doc?: InterviewDocument }) => {
    const next = new URLSearchParams(searchParameters);
    if (patch.interview !== undefined) {
      next.set('interview', String(patch.interview));
    }
    if (patch.doc !== undefined) {
      next.set('doc', patch.doc);
    }
    return `?${next.toString()}`;
  };
  const artifactOf = (interview: InterviewDetail | undefined, artifact: InterviewDocument) =>
    interview?.artifactList.find((entry) => entry.artifact === artifact);
  const openAdd = () => {
    setDialog({ isOpen: true, interview: null });
  };

  const interviewDialog = (
    <InterviewDialog
      posting={posting}
      interview={dialog.interview}
      isOpen={dialog.isOpen}
      onOpenChange={(isOpen) => {
        setDialog((previous) => ({ ...previous, isOpen }));
      }}
    />
  );

  if (selected === undefined) {
    return (
      <section aria-label={t('interviews.heading')}>
        <InterviewsEmpty
          action={
            hasApplication ? (
              <Button size="sm" onClick={openAdd}>
                <CalendarPlusIcon />
                {t('interviews.add')}
              </Button>
            ) : null
          }
        />
        {interviewDialog}
      </section>
    );
  }

  const artifact = artifactOf(selected, document);
  return (
    <section aria-label={t('interviews.heading')} className="@container">
      <div className="grid gap-6 @4xl:grid-cols-[17rem_minmax(0,1fr)]">
        <InterviewList
          interviewList={interviewList}
          selectedNumber={selected.number}
          searchOf={(number) => searchOf({ interview: number })}
          summaryOf={(number, artifactName) =>
            tabSummaryOf(
              artifactOf(
                interviewList.find((interview) => interview.number === number),
                artifactName,
              ),
            )
          }
          now={now}
          addButton={
            hasApplication && (
              <Button variant="ghost" size="xs" onClick={openAdd}>
                <CalendarPlusIcon />
                {t('interviews.addShort')}
                <span className="sr-only"> · {t('interviews.add')}</span>
              </Button>
            )
          }
        />
        <div className="min-w-0 space-y-5">
          <InterviewSummary
            interview={selected}
            now={now}
            actions={
              <>
                <Button asChild size="sm">
                  <Link to={revisionPathOf(posting.reference, selected.number)}>
                    <GraduationCapIcon />
                    {t('interviews.revise')}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={icalHrefOf(posting.reference, selected.number)} download>
                    <DownloadIcon />
                    {t('interviews.ical')}
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t('interviews.edit', { number: selected.number })}
                  onClick={() => {
                    setDialog({ isOpen: true, interview: selected });
                  }}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('interviews.delete', { number: selected.number })}
                  className="text-muted-foreground hover:text-destructive"
                  isPending={removalFetcher.state !== 'idle'}
                  onClick={() => {
                    setIsDeleteOpen(true);
                  }}
                >
                  <Trash2Icon />
                </Button>
              </>
            }
          />
          <Tabs
            value={document}
            onValueChange={(value) => {
              if (isInterviewDocument(value)) {
                setSearchParameters(new URLSearchParams(searchOf({ interview: selected.number, doc: value })), {
                  replace: true,
                  preventScrollReset: true,
                });
              }
            }}
          >
            <TabsList
              variant="line"
              aria-label={t('interviews.documents', { number: selected.number })}
              className="h-auto w-full justify-start rounded-none border-b px-0 pb-1 group-data-horizontal/tabs:h-auto"
            >
              {INTERVIEW_DOCUMENT_LIST.map((value) => {
                const summary = tabSummaryOf(artifactOf(selected, value));
                return (
                  <TabsTrigger key={value} value={value} className="flex-none gap-2 px-3 py-2">
                    <StateDot summary={summary} />
                    {t(`artifactLabelByArtifact.${value}`, { ns: 'common' })}
                    <StateLabel summary={summary} />
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
          {artifact !== undefined && (
            <ArtifactView
              key={`${String(selected.number)}-${document}`}
              reference={posting.reference}
              title={posting.title}
              interviewNumber={selected.number}
              {...artifact}
            />
          )}
        </div>
      </div>
      {interviewDialog}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('interviews.deleteTitle', { number: selected.number })}</AlertDialogTitle>
            <AlertDialogDescription>{t('interviews.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('interviews.keep')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                deleted.current.number = selected.number;
                void removalFetcher.submit(
                  { intent: 'delete', number: selected.number },
                  {
                    method: 'post',
                    action: `/postings/${encodeURIComponent(posting.reference)}/interviews`,
                    preventScrollReset: true,
                  },
                );
              }}
            >
              {t('interviews.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
