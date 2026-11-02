// PROTOTYPE · owned by the generation panel agent (DECISIONS.md « Generation panel »): clicking
// « Générer » never runs directly; this panel explains the run in plain words (what Claude reads, does,
// writes, how long), lists its Inputs (required locked with a tooltip, default checked, Annexes to add,
// « + Ajouter un texte ou un fichier »), previews each Input's exact text, shows the Instructions
// editable in place and the Fixed Part folded, prefills a regeneration with the previous Version's
// Inputs, then « Lancer » → simulated progress → a new Draft Version.
//
// Three structurally different variants on ?panel= (independent from the page's ?variant=), Shift + ←→;
// the user chose C on 2026-11-02, the default without ?panel=:
//   A « Dialog »  centered, a single scroll, previews unfold in place          generation/variant-a.tsx
//   B « Sheet »   wide right Sheet, checklist left, live Prompt preview right   generation/variant-b.tsx
//   C « Étapes »  a 3-step stepper ending on a one-paragraph recap             generation/variant-c.tsx
// Their shared state lives in generation/use-generation-panel.ts, so switching keeps the checks.
// posting.tsx mounts it only while open, and keeps this signature (additive props only).
// Without the Posting page: /prototype/generation-demo/:reference?artifact=letter&panel=B.
import { useGenerationPanel } from './generation/use-generation-panel.ts';
import { PanelDialog } from './generation/variant-a.tsx';
import { PanelSheet } from './generation/variant-b.tsx';
import { PanelStepper } from './generation/variant-c.tsx';
import type { IArtifact, IInterview, IPosting } from './model.ts';
import { PrototypeSwitcher, usePrototypeVariant } from './prototype-switcher.tsx';

// The first one is the default: C, chosen by the user on 2026-11-02; A and B stay reachable
export const PANEL_VARIANTS = [
  { key: 'C', name: 'Étapes' },
  { key: 'A', name: 'Dialog' },
  { key: 'B', name: 'Sheet + aperçu' },
] as const;

export interface IGenerationPanelProps {
  artifact: IArtifact;
  posting: IPosting;
  // The Interview of an Artifact attached to one (Portrait, Interview Brief)
  interview?: IInterview | undefined;
  onClose: () => void;
}

export function GenerationPanel({ artifact, posting, interview, onClose }: IGenerationPanelProps) {
  const variant = usePrototypeVariant('panel', PANEL_VARIANTS);
  const panel = useGenerationPanel({ artifact, posting, interview });
  const subtitle = interview === undefined ? posting.title : `${posting.title} · Entretien ${String(interview.number)}`;
  const props = { panel, onClose, subtitle };
  return (
    <>
      {variant === 'A' ? <PanelDialog {...props} /> : null}
      {variant === 'B' ? <PanelSheet {...props} /> : null}
      {variant !== 'A' && variant !== 'B' ? <PanelStepper {...props} /> : null}
      <PrototypeSwitcher param="panel" variants={PANEL_VARIANTS} label="Panneau" keys="shift+arrows" />
    </>
  );
}
