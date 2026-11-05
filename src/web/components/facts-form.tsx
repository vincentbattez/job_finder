import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import { Button } from '#/web/components/ui/button.tsx';
import { Label } from '#/web/components/ui/label.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';

import { useIsHydrated } from './use-is-hydrated.ts';

type Section = Awaited<ReturnType<Actions['readFacts']>>[number];

function EntryField({
  title,
  example,
  entry,
  number,
  onDelete,
}: Readonly<{ title: string; example: string; entry: string; number: number; onDelete: () => void }>) {
  const { t } = useTranslation('settings');
  const fieldId = useId();
  const isHydrated = useIsHydrated();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={fieldId} className="text-xs text-muted-foreground">
        {t('facts.entry', { number })}
      </Label>
      <div className="flex items-start gap-2">
        <Textarea id={fieldId} name={title} defaultValue={entry} rows={2} placeholder={example} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!isHydrated}
          aria-label={t('facts.deleteEntry', { number })}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}

// A list Section, such as Diplômes: each entry is a field the Candidate adds or removes. Its key keeps
// each field with its text when an entry above it goes.
function ListSection({ title, example, entryList }: Readonly<Section>) {
  const [entryItemList, setEntryItemList] = useState(() => entryList.map((entry, key) => ({ key, entry })));
  const isHydrated = useIsHydrated();
  const { t } = useTranslation('settings');
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm font-medium">{title}</legend>
      {entryItemList.map(({ key, entry }, index) => (
        <EntryField
          key={key}
          title={title}
          example={example}
          entry={entry}
          number={index + 1}
          onDelete={() => {
            setEntryItemList(entryItemList.filter((entryItem) => entryItem.key !== key));
          }}
        />
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isHydrated}
          onClick={() => {
            const key = Math.max(-1, ...entryItemList.map((entryItem) => entryItem.key)) + 1;
            setEntryItemList([...entryItemList, { key, entry: '' }]);
          }}
        >
          <PlusIcon />
          {t('facts.add')}
        </Button>
      </div>
    </fieldset>
  );
}

function TextSection({ title, example, entryList }: Readonly<Section>) {
  const fieldId = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={fieldId}>{title}</Label>
      <Textarea id={fieldId} name={title} defaultValue={entryList.join('\n\n')} rows={2} placeholder={example} />
    </div>
  );
}

// The fields of the Facts by Section, read from facts.md, in the form its Container posts
export function FactsFields({ sectionList }: Readonly<{ sectionList: Section[] }>) {
  return (
    <div className="grid gap-6">
      {sectionList.map((section) =>
        section.isList ? (
          <ListSection key={section.title} {...section} />
        ) : (
          <TextSection key={section.title} {...section} />
        ),
      )}
    </div>
  );
}
