import { cn } from 'cn';
import { CheckIcon, NotebookPenIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { Actions } from '#/actions/index.ts';
import { sortRevision, type IRevisionSection } from '#/actions/revision-sections.ts';
import { ArtifactReader } from '#/web/components/artifact-reader.tsx';
import type { IVersionDetail } from '#/web/components/artifact.ts';
import { interviewPathOf, revisionPathOf } from '#/web/components/interviews.tsx';
import {
  DraftBanner,
  MasteredCount,
  RevisionEmpty,
  RevisionHeader,
  RevisionHero,
  RevisionSideSheet,
  TICK_MS,
  VanishedSections,
  type RevisionSide,
} from '#/web/components/revision.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';
import { useNow } from '#/web/components/use-now.ts';
import type { IRefusal } from '#/web/failure.ts';

import { useValidation } from './artifact-view.tsx';
import { useFeedback } from './use-feedback.ts';

// Above the card the margin scrolls to
const MARGIN_SCROLL_GAP_PX = 8;

type PostingDetail = Awaited<ReturnType<Actions['readPosting']>>;
type ArtifactDetail = PostingDetail['artifactList'][number];

// The Version an Artifact is read in from the side Sheet: its Chosen one, else its latest ready one
function readableOf(artifact: ArtifactDetail | undefined): { text: string; format: 'mdx' | 'markdown' } | null {
  const detail =
    artifact?.versionList.find(({ version, text }) => version.isChosen && text !== null) ??
    artifact?.versionList.findLast(({ text }) => text !== null);
  return artifact === undefined || detail?.text == null ? null : { text: detail.text, format: artifact.format };
}

// One note card of the margin (DESIGN.md « Reading mode, rail and margin »): the section's title, its
// Mastered toggle and its note, each saved through the Revision's own actions
function SectionCard({
  action,
  section,
  index,
  isActive,
}: Readonly<{ action: string; section: IRevisionSection; index: number; isActive: boolean }>) {
  const { t } = useTranslation('posting');
  const noteId = useId();
  const cardReference = useRef<HTMLLIElement>(null);
  // What the Candidate typed, until it is the saved note
  const [editedNote, setEditedNote] = useState<string | null>(null);
  const note = editedNote ?? section.note;
  const noteFetcher = useFetcher<IRefusal>();
  const masteredFetcher = useFetcher<IRefusal>();
  useFeedback(noteFetcher, () => t('revision.noteSaved', { title: section.title }));
  // Shown as asked while the mark is on its way
  const pendingMark = masteredFetcher.formData?.get('isMastered');
  const isMastered = pendingMark === undefined ? section.isMastered : pendingMark === 'true';
  useFeedback(masteredFetcher, () =>
    t(isMastered ? 'revision.markedMastered' : 'revision.markedToReview', { title: section.title }),
  );
  // The card of the section being read stays in view in the margin's own scroll, never the window's
  useEffect(() => {
    const card = cardReference.current;
    const scroller = card?.closest<HTMLElement>('[data-reader-margin]');
    if (!isActive || card == null || scroller == null) {
      return;
    }
    const offset = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (offset < 0 || offset + card.offsetHeight > scroller.clientHeight) {
      scroller.scrollTo({ top: scroller.scrollTop + offset - MARGIN_SCROLL_GAP_PX, behavior: 'smooth' });
    }
  }, [isActive]);
  return (
    <li
      ref={cardReference}
      aria-current={isActive ? 'location' : undefined}
      className={cn(
        'rounded-xl border bg-card p-3 transition-colors',
        isActive && 'border-primary/40 ring-1 ring-primary/20',
      )}
    >
      <p className="mb-2 flex items-start gap-2 text-sm font-medium">
        <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold text-muted-foreground tabular-nums">
          {index + 1}
        </span>
        <span className="min-w-0">{section.title}</span>
      </p>
      <masteredFetcher.Form method="post" action={action} preventScrollReset>
        <input type="hidden" name="intent" value="mastered" />
        <input type="hidden" name="title" value={section.title} />
        <input type="hidden" name="isMastered" value={String(!isMastered)} />
        <Button
          type="submit"
          variant={isMastered ? 'secondary' : 'outline'}
          size="xs"
          aria-pressed={isMastered}
          aria-label={t('revision.markMastered', { title: section.title })}
          isPending={masteredFetcher.state !== 'idle'}
          className={cn(isMastered && 'text-validated-foreground')}
        >
          <CheckIcon />
          {isMastered ? t('revision.mastered') : t('revision.toMaster')}
        </Button>
      </masteredFetcher.Form>
      <noteFetcher.Form method="post" action={action} preventScrollReset className="mt-3 grid gap-1.5">
        <input type="hidden" name="intent" value="note" />
        <input type="hidden" name="title" value={section.title} />
        <label htmlFor={noteId} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <NotebookPenIcon aria-hidden className="size-3.5" />
          {t('revision.noteLabel')}
          <span className="sr-only"> · {section.title}</span>
        </label>
        <Textarea
          id={noteId}
          name="note"
          value={note}
          onChange={(event) => {
            setEditedNote(event.target.value);
          }}
          placeholder={t('revision.notePlaceholder')}
          className="min-h-20 resize-y bg-background text-sm"
        />
        {(note !== section.note || noteFetcher.state !== 'idle') && (
          <Button type="submit" size="xs" className="justify-self-end" isPending={noteFetcher.state !== 'idle'}>
            {t('revision.saveNote')}
          </Button>
        )}
      </noteFetcher.Form>
    </li>
  );
}

// The Revision of an Interview (spec #125, « Reading and Revision »): its Chosen Interview Brief read with
// the rail and a margin of notes and Mastered marks, which follow a newer Chosen Version by section title,
// a banner while a newer Draft waits, and the Portrait, the Posting and the Letter in a side Sheet
export function Revision({
  detail,
  number,
  savedList,
  now: loadedAt,
}: Readonly<{ detail: PostingDetail; number: number; savedList: IRevisionSection[]; now: number }>) {
  const { t } = useTranslation('posting');
  const now = useNow(TICK_MS, loadedAt);
  const [side, setSide] = useState<RevisionSide | null>(null);
  const [titleList, setTitleList] = useState<string[]>([]);
  const [readDraftNumber, setReadDraftNumber] = useState<number | null>(null);
  const { posting } = detail;
  const renderValidateButton = useValidation({
    reference: posting.reference,
    interviewNumber: number,
    artifact: 'interview_brief',
  });
  const interview = detail.interviewList.find((other) => other.number === number);
  if (interview === undefined) {
    return null;
  }
  const brief = interview.artifactList.find(({ artifact }) => artifact === 'interview_brief');
  const versionList: IVersionDetail[] = brief?.versionList ?? [];
  const chosen = versionList.find(({ version, text }) => version.isChosen && text !== null);
  const latest = versionList.findLast(({ version }) => version.state === 'ready');
  const draft =
    latest !== chosen && latest?.version.validation === 'draft' && latest.isValidatable ? latest : undefined;
  const isReadingDraft = draft !== undefined && readDraftNumber === draft.version.number;
  const { sectionList, vanishedList } = sortRevision(titleList, savedList);
  const action = revisionPathOf(posting.reference, number);
  const backTo = interviewPathOf(posting.reference, number);
  const backLabel =
    chosen === undefined ? t('revision.closeDraft') : t('revision.backToChosen', { number: chosen.version.number });
  const readLabel = isReadingDraft ? backLabel : t('revision.readDraft', { number: draft?.version.number });
  const portrait = interview.artifactList.find(({ artifact }) => artifact === 'portrait');
  const letter = detail.artifactList.find(({ artifact }) => artifact === 'letter');

  function renderReader() {
    if (isReadingDraft) {
      return (
        <ArtifactReader key={`draft-${String(draft.version.number)}`} text={draft.text ?? ''} format="mdx" isRevising />
      );
    }
    if (chosen === undefined) {
      return <RevisionEmpty backTo={backTo} />;
    }
    return (
      <ArtifactReader
        key={`chosen-${String(chosen.version.number)}`}
        text={chosen.text ?? ''}
        format={brief?.format ?? 'mdx'}
        isRevising
        margin={{
          onTitleListChange: setTitleList,
          render: ({ activeIndex }) => (
            <>
              <ol className="space-y-3">
                {sectionList.map((section, index) => (
                  <SectionCard
                    key={section.title}
                    action={action}
                    section={section}
                    index={index}
                    isActive={index === activeIndex}
                  />
                ))}
              </ol>
              <VanishedSections vanishedList={vanishedList} />
            </>
          ),
        }}
      />
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <RevisionHeader
        number={number}
        postingTitle={posting.title}
        backTo={backTo}
        interview={interview}
        now={now}
        onOpenSide={setSide}
      />
      <main className="mx-auto w-full max-w-[96rem] px-4 pb-28 sm:px-6 lg:px-8">
        <RevisionHero interview={interview} now={now} />
        <div className="mt-5 mb-8 grid gap-3">
          {chosen !== undefined && sectionList.length > 0 && (
            <MasteredCount
              masteredCount={sectionList.filter(({ isMastered }) => isMastered).length}
              count={sectionList.length}
            />
          )}
          {draft !== undefined && (
            <DraftBanner
              draftNumber={draft.version.number}
              chosenNumber={chosen?.version.number ?? null}
              isReadingDraft={isReadingDraft}
              readButton={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReadDraftNumber(isReadingDraft ? null : draft.version.number);
                  }}
                >
                  {readLabel}
                </Button>
              }
              validateButton={renderValidateButton(draft.version.number, 'validate')}
            />
          )}
        </div>
        {renderReader()}
      </main>
      <RevisionSideSheet
        side={side}
        onSideChange={setSide}
        documentBySide={{
          portrait: readableOf(portrait),
          posting: { text: detail.jobDescription, format: 'markdown' },
          letter: readableOf(letter),
        }}
      />
    </div>
  );
}
