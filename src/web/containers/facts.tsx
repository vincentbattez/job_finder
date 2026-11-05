import { SaveIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import type { Actions } from '#/actions/index.ts';
import { FactsFields } from '#/web/components/facts-form.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
import type { IRefusal } from '#/web/failure.ts';

import { useFeedback } from './use-feedback.ts';

// The Facts by Section, written back into facts.md; the rest of the file stays as written. Its Save
// waits for React, which resets a textarea when it takes over the page
export function FactsForm({ sectionList }: Readonly<{ sectionList: Awaited<ReturnType<Actions['readFacts']>> }>) {
  const { t } = useTranslation('settings');
  const isHydrated = useIsHydrated();
  const fetcher = useFetcher<IRefusal>();
  useFeedback(fetcher, () => t('facts.saved'));
  return (
    <fetcher.Form method="post" action="/profile" preventScrollReset className="grid gap-6">
      <input type="hidden" name="intent" value="facts" />
      {/* Keyed by their content, so that a save of facts.md shows in the fields */}
      <FactsFields key={JSON.stringify(sectionList)} sectionList={sectionList} />
      <div className="flex justify-end">
        <Button type="submit" disabled={!isHydrated} isPending={fetcher.state !== 'idle'}>
          <SaveIcon />
          {t('facts.save')}
        </Button>
      </div>
    </fetcher.Form>
  );
}
