import { ClipboardCopyIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '#/web/components/ui/button.tsx';

import type { Generation } from './artifact.ts';
import { Blockers, KindIcon, type IPanelInput } from './generation-read-step.tsx';

function RecapItem({ term, children }: Readonly<{ term: string; children: ReactNode }>) {
  return (
    <div className="space-y-1">
      <dt className="text-label font-medium tracking-wide text-muted-foreground uppercase">{term}</dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  );
}

// Each read Input with its weight in what Claude reads, largest first, then the total
function ReadBreakdown({ readList, totalWords }: Readonly<{ readList: IPanelInput[]; totalWords: number }>) {
  const { t } = useTranslation('posting');
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="max-w-none text-label font-medium tracking-wide text-muted-foreground uppercase">
        {t('generation.breakdown')}
      </h3>
      <ul className="divide-y rounded-lg border">
        {readList
          .toSorted((first, second) => second.wordCount - first.wordCount)
          .map((input) => {
            const share = totalWords === 0 ? 0 : input.wordCount / totalWords;
            return (
              <li key={input.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <KindIcon kind={input.kind} className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{input.label}</span>
                </span>
                <span className="text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {t('generation.words', { count: input.wordCount })} ·{' '}
                  <span className="inline-block w-10 font-medium text-foreground">
                    {t('generation.percent', { value: share })}
                  </span>
                </span>
                <div aria-hidden className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${String(share * 100)}%` }} />
                </div>
              </li>
            );
          })}
        <li className="flex items-center justify-between gap-4 bg-muted/40 px-3 py-2 text-sm font-medium">
          <span>{t('generation.total', { documents: t('generation.documents', { count: readList.length }) })}</span>
          <span className="text-xs whitespace-nowrap tabular-nums">
            {t('generation.words', { count: totalWords })} ·{' '}
            <span className="inline-block w-10">{t('generation.percent', { value: 1 })}</span>
          </span>
        </li>
      </ul>
    </section>
  );
}

interface IRecap {
  generation: Generation;
  readList: IPanelInput[];
  totalWords: number;
  blockerList: string[];
  // The Prompt of the read Inputs, null while it loads or while the run is refused
  prompt: string | null;
  onCopy: (prompt: string) => void;
}

// Step 3, recap and launch: the run in plain words, then the details it rests on
export function RecapStep({ generation, readList, totalWords, blockerList, prompt, onCopy }: Readonly<IRecap>) {
  const { t } = useTranslation('posting');
  const { artifact, nextNumber, chosenNumber, isSearchingWeb } = generation;
  const artifactLabel = t(`artifactLabelByArtifact.${artifact}`, { ns: 'common' });
  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-7">
        {t(`generation.doesByArtifact.${artifact}`)}{' '}
        {t('generation.recapReads', {
          documents: t('generation.documents', { count: readList.length }),
          words: t('generation.words', { count: totalWords }),
          writes: t('generation.writes', { artifactLabel, number: nextNumber }),
        })}
      </p>
      <ReadBreakdown readList={readList} totalWords={totalWords} />
      <dl className="grid gap-3 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-3">
        <RecapItem term={t('generation.afterTerm')}>
          {chosenNumber === null ? t('generation.keepsNone') : t('generation.keepsChosen', { number: chosenNumber })}
        </RecapItem>
        <RecapItem term={t('generation.durationTerm')}>
          {t('generation.durationValue', { duration: t(`generation.durationByArtifact.${artifact}`) })}
        </RecapItem>
        <RecapItem term={t('generation.webTerm')}>
          {isSearchingWeb ? t('generation.webYes') : t('generation.webNo')}
        </RecapItem>
      </dl>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t('generation.copyHint')}</p>
        <Button
          variant="outline"
          size="sm"
          disabled={prompt === null}
          onClick={() => {
            if (prompt !== null) {
              onCopy(prompt);
            }
          }}
        >
          <ClipboardCopyIcon data-icon="inline-start" />
          {t('generation.copyPrompt')}
        </Button>
      </div>
      <Blockers blockerList={blockerList} />
    </div>
  );
}
