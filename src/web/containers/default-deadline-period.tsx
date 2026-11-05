import { SaveIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { SettingsSection } from '#/web/components/settings-section.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Input } from '#/web/components/ui/input.tsx';
import { Label } from '#/web/components/ui/label.tsx';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

// The Default Deadline Period every Candidate shares, for the operator (ADR-0011): a Posting published
// without a Deadline is Expired this many months after its publication
export function DefaultDeadlinePeriod({ months }: Readonly<{ months: number }>) {
  const { t } = useTranslation('settings');
  const fieldId = useId();
  const fetcher = useFetcher<IRefusal>();
  useFeedback(fetcher, () => t('defaultDeadlinePeriod.saved'));
  return (
    <SettingsSection heading={t('defaultDeadlinePeriod.heading')} description={t('defaultDeadlinePeriod.hint')}>
      {/* Remounted once saved, so the field shows the Period saved */}
      <fetcher.Form key={months} method="post" action="/settings" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="intent" value="default-deadline-period" />
        <div className="grid gap-2">
          <Label htmlFor={fieldId}>{t('defaultDeadlinePeriod.months')}</Label>
          <Input
            id={fieldId}
            name="months"
            type="number"
            min={1}
            step={1}
            required
            defaultValue={months}
            className="w-28 tabular-nums"
          />
        </div>
        <Button type="submit" className="ml-auto" isPending={fetcher.state !== 'idle'}>
          <SaveIcon />
          {t('defaultDeadlinePeriod.save')}
        </Button>
      </fetcher.Form>
    </SettingsSection>
  );
}
