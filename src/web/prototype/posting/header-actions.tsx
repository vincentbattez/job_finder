// PROTOTYPE · Posting page agent. The head of the Posting page (DECISIONS.md « Posting page »): ONE
// primary action that follows the Step, the rest in a ⋯ menu. Marking Applied while the Letter is a
// Draft asks first (AlertDialog): validate the Letter and mark Applied, or mark Applied without it.
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CalendarPlusIcon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  MoreHorizontalIcon,
  RepeatIcon,
  RotateCcwIcon,
  SendIcon,
  ThumbsDownIcon,
  TrophyIcon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/web/prototype/components/ui/alert-dialog.tsx';
import { Badge } from '#/web/prototype/components/ui/badge.tsx';
import { Button } from '#/web/prototype/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/web/prototype/components/ui/dropdown-menu.tsx';
import { cn } from '#/web/prototype/lib/utils.ts';

import { nextInterviewOf, STEP_LABEL, type IPosting, type Step } from '../model.ts';
import { useActions } from '../store.ts';
import { InterviewDialog } from './interview-dialog.tsx';
import { revisionPathOf } from './interviews-tab.tsx';

const STEP_TONE: Record<Step, string> = {
  new: 'bg-primary text-primary-foreground',
  to_apply: 'bg-secondary text-secondary-foreground',
  applied: 'bg-secondary text-secondary-foreground',
  invited: 'bg-primary/10 text-primary',
  interviewed: 'bg-secondary text-secondary-foreground',
  hired: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  rejected: 'bg-muted text-muted-foreground',
};

export function StepBadge({ posting, className }: { posting: IPosting; className?: string }) {
  return (
    <Badge className={cn('border-transparent', STEP_TONE[posting.step], className)}>
      {posting.archivedAt === null ? STEP_LABEL[posting.step] : `${STEP_LABEL[posting.step]} · archivée`}
    </Badge>
  );
}

export function PostingActions({ posting }: { posting: IPosting }) {
  const actions = useActions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pending, setPending] = useState<string | null>(null);
  const [isAppliedOpen, setIsAppliedOpen] = useState(false);
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const { reference, step } = posting;
  const isArchived = posting.archivedAt !== null;
  const nextInterview = nextInterviewOf(posting.interviews);
  const isInProgress = step === 'applied' || step === 'invited' || step === 'interviewed';

  async function run(key: string, action: () => Promise<void>) {
    setPending(key);
    await action();
    setPending(null);
  }

  function markApplied() {
    if (posting.letter.state !== 'validated') {
      setIsAppliedOpen(true);
      return;
    }
    void run('applied', () => actions.setStatus(reference, 'applied'));
  }

  async function validateLetterThenApply() {
    const number = posting.letter.latestNumber;
    if (number !== null) {
      await actions.validateVersion(reference, 'letter', number);
    }
    await actions.setStatus(reference, 'applied');
  }

  const isPending = (key: string) => pending === key;

  function primary() {
    if (isArchived) {
      return (
        <Button
          size="sm"
          disabled={isPending('unarchive')}
          onClick={() => void run('unarchive', () => actions.unarchive(reference))}
        >
          <ArchiveRestoreIcon />
          Désarchiver
        </Button>
      );
    }
    switch (step) {
      case 'new':
        return (
          <Button
            size="sm"
            disabled={isPending('keep')}
            onClick={() => void run('keep', () => actions.keep(reference))}
          >
            <CheckIcon />
            Garder
          </Button>
        );
      case 'to_apply':
        return (
          <Button size="sm" disabled={isPending('applied')} onClick={markApplied}>
            <SendIcon />
            Marquer Postulée
          </Button>
        );
      case 'applied':
        return (
          <Button size="sm" onClick={() => setIsInterviewOpen(true)}>
            <CalendarPlusIcon />
            <span className="hidden sm:inline">Ajouter un Entretien</span>
            <span className="sm:hidden">Entretien</span>
          </Button>
        );
      case 'invited':
        return nextInterview === null ? null : (
          <Button size="sm" asChild>
            <Link to={revisionPathOf(reference, nextInterview.number, searchParams.get('variant'))}>
              <GraduationCapIcon />
              <span className="hidden sm:inline">Réviser l’Entretien {nextInterview.number}</span>
              <span className="sm:hidden">Réviser</span>
            </Link>
          </Button>
        );
      case 'interviewed':
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                Indiquer le résultat
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void run('hired', () => actions.setStatus(reference, 'hired'))}>
                <TrophyIcon />
                Poste obtenu
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void run('rejected', () => actions.setStatus(reference, 'rejected'))}>
                <ThumbsDownIcon />
                Refusée
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      case 'hired':
      case 'rejected':
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending('reopen')}
            onClick={() => void run('reopen', () => actions.setStatus(reference, 'applied'))}
          >
            <RotateCcwIcon />
            Remettre en cours
          </Button>
        );
    }
  }

  return (
    <>
      <StepBadge posting={posting} className="hidden sm:inline-flex" />
      {primary()}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="Plus d’actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          {step === 'new' && !isArchived ? (
            <DropdownMenuItem onSelect={() => void run('dismiss', () => actions.dismiss(reference))}>
              <XIcon />
              Écarter
            </DropdownMenuItem>
          ) : null}
          {isInProgress && !isArchived ? (
            <>
              {step === 'applied' ? null : (
                <DropdownMenuItem onSelect={() => setIsInterviewOpen(true)}>
                  <CalendarPlusIcon />
                  Ajouter un Entretien
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => void run('hired', () => actions.setStatus(reference, 'hired'))}>
                <TrophyIcon />
                Poste obtenu
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void run('rejected', () => actions.setStatus(reference, 'rejected'))}>
                <ThumbsDownIcon />
                Refusée
              </DropdownMenuItem>
              {step === 'applied' ? (
                <DropdownMenuItem onSelect={() => void run('to_apply', () => actions.setStatus(reference, 'to_apply'))}>
                  <RotateCcwIcon />
                  Remettre À traiter (pas envoyée)
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
            </>
          ) : null}
          {posting.url === null ? null : (
            <DropdownMenuItem asChild>
              <a href={posting.url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon />
                Ouvrir sur {posting.source}
              </a>
            </DropdownMenuItem>
          )}
          {posting.repost.repostOf === null ? null : (
            <DropdownMenuItem onSelect={() => void navigate(`/prototype/postings/${posting.repost.repostOf ?? ''}`)}>
              <RepeatIcon />
              Republication de {posting.repost.repostOf}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isArchived ? (
            <DropdownMenuItem onSelect={() => void run('unarchive', () => actions.unarchive(reference))}>
              <ArchiveRestoreIcon />
              Désarchiver
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void run('archive', () => actions.archive(reference))}>
              <ArchiveIcon />
              Archiver
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <InterviewDialog
        reference={reference}
        interview={null}
        isOpen={isInterviewOpen}
        onOpenChange={setIsInterviewOpen}
      />

      <AlertDialog open={isAppliedOpen} onOpenChange={setIsAppliedOpen}>
        <AlertDialogContent className="data-[size=default]:sm:max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {posting.letter.state === 'draft' ? 'La Lettre est encore un Brouillon' : 'Aucune Lettre validée'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {posting.letter.state === 'draft'
                ? `La Version ${String(posting.letter.latestNumber ?? '')} de la Lettre n’est pas validée. Seule une Lettre validée est celle que tu as envoyée ; une fois Postulée, elle ne change plus.`
                : 'Cette Offre n’a pas de Lettre. Tu peux la marquer Postulée sans Lettre, si tu as candidaté autrement.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={() => void run('applied', () => actions.setStatus(reference, 'applied'))}
            >
              Marquer Postulée sans Lettre
            </AlertDialogAction>
            {posting.letter.state === 'draft' ? (
              <AlertDialogAction onClick={() => void run('applied', validateLetterThenApply)}>
                <CheckIcon />
                Valider la Lettre et marquer Postulée
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
