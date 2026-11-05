import { cn } from 'cn';
import { ChevronRightIcon, LockIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Artifact } from '#/actions/index.ts';
import { segmentsOf } from '#/actions/substitution.ts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/web/components/ui/collapsible.tsx';

import type { Generation } from './artifact.ts';

// A value the tool substituted in the Fixed Part: fuchsia, never Invited's violet (DESIGN.md « Substituted values »)
const SUBSTITUTED_CLASS =
  'rounded-[3px] bg-substituted/12 px-0.5 text-substituted-foreground ring-1 ring-substituted/30 ring-inset';

// The Fixed Part's exact text, each value the tool substituted for this Posting or Interview highlighted
function FixedPart({ marked }: Readonly<{ marked: string }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn(SUBSTITUTED_CLASS, 'shrink-0')}>{t('generation.substitutedChip')}</span>
        <span>{t('generation.substitutedLegend')}</span>
      </p>
      <pre className="font-sans text-[13px] leading-relaxed wrap-anywhere whitespace-pre-wrap text-muted-foreground">
        {segmentsOf(marked).map(({ text, isSubstituted }, index) =>
          isSubstituted ? (
            // The segments of one text never move: their index keys them
            <mark key={index} className={SUBSTITUTED_CLASS} title={t('generation.substituted')}>
              {text}
            </mark>
          ) : (
            text
          ),
        )}
      </pre>
    </div>
  );
}

// Step 2, how it writes: the Instructions in effect, in the editor its Container hands in, then the Fixed
// Part, folded and read-only
export function WriteStep({
  artifact,
  prompt,
  instructions,
}: Readonly<{ artifact: Artifact; prompt: Generation['prompt']; instructions: ReactNode }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('generation.writeIntro', {
          context: artifact,
          artifactLabel: t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' }),
        })}
      </p>
      <section className="space-y-2">
        <h3 className="max-w-none text-sm font-medium">{t('generation.instructions')}</h3>
        {instructions ?? (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap">
            {prompt?.instructions}
          </p>
        )}
      </section>
      {prompt !== null && (
        <Collapsible className="rounded-lg border">
          <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronRightIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
            />
            <span className="font-medium">{t('generation.fixedPart')}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <LockIcon aria-hidden className="size-3" /> {t('generation.notEditable')}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t px-3 py-3">
            <FixedPart marked={prompt.markedFixedPart} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
