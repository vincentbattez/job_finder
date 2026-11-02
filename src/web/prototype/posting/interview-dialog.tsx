// PROTOTYPE · Posting page agent. Add or edit an Interview in a Dialog: its day and time (Paris), its
// duration, its place and its Interviewers, in free text. Once a new one is added, the Dialog turns
// into « Entretien ajouté », offering its iCal file (posting/ics.ts); closing it lands on that Interview
// (?tab=interviews&interview=<n>), wherever the Candidate added it from.
import { CalendarCheck2Icon, CheckIcon, DownloadIcon, MapPinIcon, UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/web/prototype/components/ui/dialog.tsx';
import { Input } from '#/web/prototype/components/ui/input.tsx';
import { Label } from '#/web/prototype/components/ui/label.tsx';
import { Textarea } from '#/web/prototype/components/ui/textarea.tsx';

import type { IInterview, IPosting } from '../model.ts';
import { useActions, usePosting } from '../store.ts';
import { downloadIcs, icsFileNameOf, icsOf } from './ics.ts';
import { revisionPathOf } from './interviews-tab.tsx';
import { formatLongDay, formatTime, fromParis, parisParts } from './time.ts';

const DEFAULT_DURATION_MINUTES = 30;

function InterviewForm({
  reference,
  interview,
  onDone,
  onAdded,
}: {
  reference: string;
  interview: IInterview | null;
  onDone: () => void;
  onAdded: (interview: IInterview) => void;
}) {
  const { saveInterview } = useActions();
  const posting = usePosting(reference);
  const initial = interview === null ? null : parisParts(interview.startAt);
  const [date, setDate] = useState(initial?.date ?? '');
  const [time, setTime] = useState(initial?.time ?? '');
  const [duration, setDuration] = useState(String(interview?.durationMinutes ?? DEFAULT_DURATION_MINUTES));
  const [place, setPlace] = useState(interview?.place ?? '');
  const [interviewers, setInterviewers] = useState(interview?.interviewers ?? '');
  const [isPending, setIsPending] = useState(false);
  const isValid = date !== '' && time !== '' && Number(duration) > 0;

  async function submit() {
    setIsPending(true);
    const saved = {
      startAt: fromParis(date, time),
      durationMinutes: Number(duration),
      place: place.trim(),
      interviewers: interviewers.trim(),
    };
    await saveInterview(reference, { number: interview?.number, ...saved });
    setIsPending(false);
    if (interview === null) {
      // The store numbers a new Interview after the highest one
      const number = Math.max(0, ...(posting?.interviews ?? []).map((other) => other.number)) + 1;
      onAdded({ number, ...saved });
    } else {
      onDone();
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_7rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="interview-date">Jour</Label>
          <Input id="interview-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="interview-time">Heure (Paris)</Label>
          <Input id="interview-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="interview-duration">Durée (min)</Label>
          <Input
            id="interview-duration"
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="interview-place">Lieu</Label>
        <Input
          id="interview-place"
          value={place}
          placeholder="Visio, adresse du tribunal…"
          onChange={(event) => setPlace(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="interview-interviewers">Interlocuteurs</Label>
        <Textarea
          id="interview-interviewers"
          value={interviewers}
          placeholder="Nom, fonction, tout ce que tu sais d’eux : le Portrait part de là."
          className="min-h-24"
          onChange={(event) => setInterviewers(event.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={!isValid || isPending}>
          {isPending ? 'Enregistrement…' : interview === null ? 'Ajouter l’Entretien' : 'Enregistrer'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// « Entretien ajouté »: the iCal file first, « Plus tard » second
function AddedConfirmation({
  posting,
  interview,
  onClose,
}: {
  posting: IPosting;
  interview: IInterview;
  onClose: () => void;
}) {
  const [searchParams] = useSearchParams();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const fileName = icsFileNameOf(posting.reference, interview.number);
  const day = Number(parisParts(interview.startAt).date.split('-')[2]);
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'Europe/Paris' }).format(
    new Date(interview.startAt),
  );

  function download() {
    const revisionUrl = `${window.location.origin}${revisionPathOf(posting.reference, interview.number, searchParams.get('variant'))}`;
    downloadIcs(fileName, icsOf({ posting, interview, revisionUrl }));
    setIsDownloaded(true);
  }

  return (
    <>
      <DialogHeader className="items-center text-center sm:items-center sm:text-center">
        <div className="mb-1 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <CalendarCheck2Icon className="size-6" />
        </div>
        <DialogTitle className="text-lg">Entretien ajouté</DialogTitle>
        <DialogDescription className="text-balance">
          Ajoute-le à ton agenda : le fichier iCal s’ouvre dans Calendrier, Google Agenda ou Outlook, avec un rappel une
          heure avant.
        </DialogDescription>
      </DialogHeader>
      <div className="flex gap-4 rounded-xl border bg-muted/30 p-4" data-testid="interview-event">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border bg-background py-1.5">
          <span className="text-[11px] font-medium text-primary uppercase">{monthLabel.replace('.', '')}</span>
          <span className="text-2xl leading-none font-semibold tabular-nums">{day}</span>
        </div>
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-semibold first-letter:uppercase">
            {formatLongDay(interview.startAt)} à {formatTime(interview.startAt)} · {interview.durationMinutes} min
          </p>
          <p className="line-clamp-1 text-muted-foreground">
            Entretien {interview.number} · {posting.title}
          </p>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPinIcon className="mt-px size-3.5 shrink-0" />
            <span className="line-clamp-1">{interview.place || '—'}</span>
          </p>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <UsersIcon className="mt-px size-3.5 shrink-0" />
            <span className="line-clamp-2">{interview.interviewers || '—'}</span>
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        <Button size="lg" className="h-11 w-full text-base" onClick={download}>
          {isDownloaded ? <CheckIcon /> : <DownloadIcon />}
          {isDownloaded ? 'Fichier iCal téléchargé' : 'Télécharger le fichier iCal (.ics)'}
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
          {isDownloaded ? 'Voir l’Entretien' : 'Plus tard'}
        </Button>
        {isDownloaded ? <p className="text-center text-xs text-muted-foreground">{fileName}</p> : null}
      </div>
    </>
  );
}

export function InterviewDialog({
  reference,
  interview,
  isOpen,
  onOpenChange,
}: {
  reference: string;
  // null: a new one
  interview: IInterview | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const posting = usePosting(reference);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [added, setAdded] = useState<IInterview | null>(null);

  // Closing « Entretien ajouté », however, lands on that Interview
  function close() {
    onOpenChange(false);
    if (added === null) {
      return;
    }
    const params = new URLSearchParams({ tab: 'interviews', interview: String(added.number) });
    const variant = searchParams.get('variant');
    if (variant !== null) {
      params.set('variant', variant);
    }
    setAdded(null);
    void navigate(`/prototype/postings/${reference}?${params.toString()}`);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          onOpenChange(true);
        } else {
          close();
        }
      }}
    >
      <DialogContent className={added === null ? 'sm:max-w-lg' : 'sm:max-w-md'}>
        {added !== null && posting !== undefined ? (
          <AddedConfirmation posting={posting} interview={added} onClose={close} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {interview === null ? 'Ajouter un Entretien' : `Modifier l’Entretien ${String(interview.number)}`}
              </DialogTitle>
              <DialogDescription>
                La Candidature passe Convoquée tant qu’un Entretien est à venir, puis Entretien passé.
              </DialogDescription>
            </DialogHeader>
            {isOpen ? (
              <InterviewForm
                key={interview?.number ?? 'new'}
                reference={reference}
                interview={interview}
                onDone={close}
                onAdded={setAdded}
              />
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
