// PROTOTYPE · PLACEHOLDER owned by the generation panel agent (DECISIONS.md « Generation panel »):
// clicking « Générer » never runs directly; this panel explains the run, lists its Inputs (required
// locked with a tooltip, default checked, Annexes to add, « + Ajouter un texte ou un fichier »), shows
// the Instructions editable in place and the Fixed Part folded, then « Lancer ». Variants (Dialog,
// Sheet, a third form) on ?panel= with <PrototypeSwitcher param="panel" keys="shift+arrows" />.
// posting.tsx mounts it only while open, and keeps this signature.
//
// This stub only proves the wiring: the Inputs the run would read, and « Lancer ».
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

import type { IArtifact, IInterview, IPosting } from './model.ts';
import { useActions, useInputs, usePostingDetail } from './store.ts';

export interface IGenerationPanelProps {
  artifact: IArtifact;
  posting: IPosting;
  // The Interview of an Artifact attached to one (Portrait, Interview Brief)
  interview?: IInterview | undefined;
  onClose: () => void;
}

export function GenerationPanel({ artifact, posting, interview, onClose }: IGenerationPanelProps) {
  // The detail the Posting page loaded, with the store's Versions on top
  const detail = usePostingDetail(posting.reference, null);
  const inputs = useInputs(posting.reference, artifact.key, detail);
  const { startGeneration } = useActions();
  const [isPending, setIsPending] = useState(false);

  async function launch() {
    setIsPending(true);
    await startGeneration({
      reference: posting.reference,
      artifactKey: artifact.key,
      inputs: inputs.filter(({ mode }) => mode !== 'optional'),
    });
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Générer : {artifact.label}
            {interview === undefined ? '' : ` · Entretien ${String(interview.number)}`}
          </DialogTitle>
          <DialogDescription>Placeholder du panneau de génération.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-1 overflow-auto text-sm">
          {inputs.map((input) => (
            <li key={input.key} className="flex justify-between gap-4">
              <span className="truncate">{input.label}</span>
              <span className="shrink-0 text-muted-foreground">{input.mode}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={isPending || artifact.refusal !== null} onClick={() => void launch()}>
            Lancer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
