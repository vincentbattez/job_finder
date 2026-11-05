import { CheckIcon, DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher, useNavigate } from 'react-router';

import { InterviewAdded, InterviewAddedIcon, InterviewFields, type IInterview } from '#/web/components/interviews.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/web/components/ui/dialog.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';
import { useSettled } from './use-settled.ts';

// What the Dialog reads of the Posting: where it posts, its title, and where its Interviews most often take place
export interface IInterviewPosting {
  reference: string;
  title: string;
  workplace: string | null;
  city: string | null;
}

// Where an Interview most often takes place: the place of work, then its City when it does not name it
function defaultPlaceOf({ workplace, city }: Readonly<IInterviewPosting>): string {
  const hasCity = city !== null && !(workplace ?? '').toLowerCase().includes(city.toLowerCase());
  return [workplace, hasCity ? city : null].filter((part) => part !== null && part !== '').join(', ');
}

export function icalHrefOf(reference: string, number: number): string {
  return `/postings/${encodeURIComponent(reference)}/interviews/${String(number)}/ical`;
}

// The form of the Dialog: the day and the time typed apart are posted as the one start the action reads
function InterviewForm({
  posting,
  interview,
  onAdded,
  onDone,
}: Readonly<{
  posting: IInterviewPosting;
  interview: IInterview | null;
  onAdded: (interview: IInterview) => void;
  onDone: () => void;
}>) {
  const { t } = useTranslation('posting');
  // The interviews route answers an addition with the Interview added
  const fetcher = useFetcher<IRefusal & { added?: IInterview }>();
  useFeedback(fetcher, () =>
    interview === null
      ? t('interviews.addedToast', { number: fetcher.data?.added?.number })
      : t('interviews.savedToast', { number: interview.number }),
  );
  // Once its answer is in: an addition turns the Dialog into its Interview-added step, an edit closes it
  useSettled(fetcher, (answer) => {
    if (typeof answer?.error === 'string') {
      return;
    }
    if (answer?.added === undefined) {
      onDone();
    } else {
      onAdded(answer.added);
    }
  });
  return (
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const textOf = (name: string) => {
          const value = formData.get(name);
          return typeof value === 'string' ? value : '';
        };
        formData.set('start', `${textOf('day')}T${textOf('time')}`);
        formData.delete('day');
        formData.delete('time');
        void fetcher.submit(formData, {
          method: 'post',
          action: `/postings/${encodeURIComponent(posting.reference)}/interviews`,
          preventScrollReset: true,
        });
      }}
    >
      <input type="hidden" name="intent" value={interview === null ? 'add' : 'edit'} />
      {interview !== null && <input type="hidden" name="number" value={interview.number} />}
      <InterviewFields interview={interview} defaultPlace={defaultPlaceOf(posting)} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('interviews.cancel')}
        </Button>
        <Button type="submit" isPending={fetcher.state !== 'idle'}>
          {interview === null ? t('interviews.submitAdd') : t('interviews.submitEdit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Adds or edits an Interview (spec #125, « Interviews »). Once one is added, the Dialog turns into
// its Interview-added step, the iCal file first and Later second; closing it lands on that Interview
// (?tab=interviews&interview=<n>), wherever it was added from.
export function InterviewDialog({
  posting,
  interview,
  isOpen,
  onOpenChange,
}: Readonly<{
  posting: IInterviewPosting;
  // null: a new one
  interview: IInterview | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}>) {
  const { t } = useTranslation('posting');
  const navigate = useNavigate();
  const [added, setAdded] = useState<IInterview | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);

  function close() {
    onOpenChange(false);
    if (added === null) {
      return;
    }
    setAdded(null);
    setIsDownloaded(false);
    void navigate(
      `/postings/${encodeURIComponent(posting.reference)}?tab=interviews&interview=${String(added.number)}`,
      { preventScrollReset: true },
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isNowOpen) => {
        if (isNowOpen) {
          onOpenChange(true);
        } else {
          close();
        }
      }}
    >
      <DialogContent className={added === null ? 'sm:max-w-lg' : 'sm:max-w-md'}>
        {added === null ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-title">
                {interview === null ? t('interviews.add') : t('interviews.editTitle', { number: interview.number })}
              </DialogTitle>
              <DialogDescription>{t('interviews.dialogDescription')}</DialogDescription>
            </DialogHeader>
            {isOpen && <InterviewForm posting={posting} interview={interview} onAdded={setAdded} onDone={close} />}
          </>
        ) : (
          <>
            <DialogHeader className="items-center text-center">
              <InterviewAddedIcon />
              <DialogTitle className="text-title">{t('interviews.addedTitle')}</DialogTitle>
              <DialogDescription className="text-balance">{t('interviews.addedDescription')}</DialogDescription>
            </DialogHeader>
            <InterviewAdded
              interview={added}
              postingTitle={posting.title}
              actions={
                <>
                  <Button asChild size="lg" className="h-11 w-full text-base">
                    <a
                      href={icalHrefOf(posting.reference, added.number)}
                      download
                      onClick={() => {
                        setIsDownloaded(true);
                      }}
                    >
                      {isDownloaded ? <CheckIcon /> : <DownloadIcon />}
                      {t('interviews.downloadIcal')}
                    </a>
                  </Button>
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={close}>
                    {isDownloaded ? t('interviews.seeInterview') : t('interviews.later')}
                  </Button>
                </>
              }
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
