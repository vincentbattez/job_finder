// PROTOTYPE · Posting page agent. Add or edit an Interview in a Dialog: its day and time (Paris), its
// duration, its place and its Interviewers, in free text.
import { useState } from 'react';

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

import type { IInterview } from '../model.ts';
import { useActions } from '../store.ts';
import { fromParis, parisParts } from './time.ts';

const DEFAULT_DURATION_MINUTES = 30;

function InterviewForm({
  reference,
  interview,
  onDone,
}: {
  reference: string;
  interview: IInterview | null;
  onDone: () => void;
}) {
  const { saveInterview } = useActions();
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
    await saveInterview(reference, {
      number: interview?.number,
      startAt: fromParis(date, time),
      durationMinutes: Number(duration),
      place: place.trim(),
      interviewers: interviewers.trim(),
    });
    setIsPending(false);
    onDone();
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
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
