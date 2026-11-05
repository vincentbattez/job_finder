import { cn } from 'cn';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import { Badge } from '#/web/components/ui/badge.tsx';

// The stored Status, as the actions give it
export type Status = Awaited<ReturnType<Actions['listPostings']>>[number]['status'];

// The Status as the actions compute it, Invited or Interviewed from the Interviews (ADR-0009)
export type Step = Awaited<ReturnType<Actions['listPostings']>>[number]['step'];

// Each Step in its state hue (DESIGN.md « State hues »), always beside its label
const TONE_BY_STEP: Record<Step, string> = {
  new: 'bg-primary/10 text-primary',
  to_apply: 'bg-secondary text-secondary-foreground',
  applied: 'bg-step-applied/10 text-step-applied-foreground',
  invited: 'bg-step-invited/10 text-step-invited-foreground',
  interviewed: 'bg-step-interviewed/10 text-step-interviewed-foreground',
  hired: 'bg-validated/10 text-validated-foreground',
  rejected: 'bg-step-closed/10 text-step-closed-foreground',
};

// The Step of a Posting, and its Archived mark beside it, which keeps the Step (ADR-0007)
export function StepBadge({
  step,
  isArchived,
  className,
}: Readonly<{ step: Step; isArchived: boolean; className?: string }>) {
  const { t } = useTranslation();
  return (
    <Badge data-step={step} className={cn(TONE_BY_STEP[step], className)}>
      {isArchived
        ? t('stepArchived', { stepLabel: t(`statusLabelByStatus.${step}`) })
        : t(`statusLabelByStatus.${step}`)}
    </Badge>
  );
}
