import { ChevronDownIcon, FilePlusIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetcher } from 'react-router';

import { MarkdownEditor } from '#/web/components/markdown-editor.tsx';
import { Button } from '#/web/components/ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/web/components/ui/collapsible.tsx';
import { Input } from '#/web/components/ui/input.tsx';
import { Label } from '#/web/components/ui/label.tsx';
import { useIsHydrated } from '#/web/components/use-is-hydrated.ts';
import type { IRefusal } from '#/web/failure.ts';

import type { IProfileDeletion } from './profile-deletion.tsx';
import { useFeedback } from './use-feedback.ts';

// A document of the Profile, folded: its editor mounts only unfolded, its Save with it. What was typed
// survives folding, until a save, here or by the form of the Facts, brings another text.
export function ProfileDocument({
  fileName,
  markdown,
  deletion,
}: Readonly<{ fileName: string; markdown: string; deletion: IProfileDeletion }>) {
  const { t } = useTranslation('settings');
  const isHydrated = useIsHydrated();
  const fetcher = useFetcher<IRefusal>();
  useFeedback(fetcher, () => t('profileFile.saved', { fileName }));
  const [draft, setDraft] = useState({ base: markdown, text: markdown });
  const text = draft.base === markdown ? draft.text : markdown;
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <Collapsible>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full truncate font-mono text-sm sm:w-auto sm:min-w-0 sm:flex-1">{fileName}</span>
          {text !== markdown && (
            <span role="status" className="text-xs text-muted-foreground">
              {t('unsavedChanges')}
            </span>
          )}
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!isHydrated}
              aria-label={t('profileFile.editOf', { fileName })}
            >
              <ChevronDownIcon />
              {t('profileFile.edit')}
            </Button>
          </CollapsibleTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={!isHydrated}
            isPending={deletion.pendingFileName === fileName}
            aria-label={t('profileFile.deleteOf', { fileName })}
            onClick={() => {
              deletion.ask('delete', fileName);
            }}
          >
            <Trash2Icon />
            {t('profileFile.delete')}
          </Button>
        </div>
        <CollapsibleContent>
          <fetcher.Form method="post" action="/profile" preventScrollReset className="grid gap-3 pt-3">
            <input type="hidden" name="intent" value="save" />
            <input type="hidden" name="fileName" value={fileName} />
            <MarkdownEditor
              // Another text saved under it restarts the editor from that text
              key={markdown}
              name="markdown"
              label={t('profileFile.contentOf', { fileName })}
              defaultValue={text}
              placeholder={t('profileFile.contentPlaceholder')}
              onChange={(edited) => {
                setDraft({ base: markdown, text: edited });
              }}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                isPending={fetcher.state !== 'idle'}
                aria-label={t('profileFile.saveOf', { fileName })}
              >
                <SaveIcon />
                {t('profileFile.save')}
              </Button>
            </div>
          </fetcher.Form>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

// A form folded behind a button, which folds again, emptied, once what it creates is saved; a refusal
// keeps what was typed
function DocumentCreation({
  intent,
  openLabel,
  submitLabel,
  successMessage,
  children,
}: Readonly<{
  intent: 'annex' | 'create';
  openLabel: string;
  submitLabel: string;
  successMessage: string;
  children: ReactNode;
}>) {
  const { t } = useTranslation('settings');
  const isHydrated = useIsHydrated();
  const [isOpen, setIsOpen] = useState(false);
  const fetcher = useFetcher<IRefusal>();
  useFeedback(fetcher, () => successMessage);
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data !== undefined && fetcher.data.error == null) {
      setIsOpen(false);
    }
  }, [fetcher.state, fetcher.data]);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {!isOpen && (
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" disabled={!isHydrated}>
            <FilePlusIcon />
            {openLabel}
          </Button>
        </CollapsibleTrigger>
      )}
      <CollapsibleContent>
        <fetcher.Form method="post" action="/profile" preventScrollReset className="grid gap-4">
          <input type="hidden" name="intent" value={intent} />
          {children}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              {t('profileFile.cancel')}
            </Button>
            <Button type="submit" isPending={fetcher.state !== 'idle'}>
              {submitLabel}
            </Button>
          </div>
        </fetcher.Form>
      </CollapsibleContent>
    </Collapsible>
  );
}

// An Annex, named after its title
export function AnnexCreation() {
  const { t } = useTranslation('settings');
  const titleId = useId();
  return (
    <DocumentCreation
      intent="annex"
      openLabel={t('annex.write')}
      submitLabel={t('annex.add')}
      successMessage={t('annex.added')}
    >
      <div className="grid gap-2">
        <Label htmlFor={titleId}>{t('annex.title')}</Label>
        <Input id={titleId} name="title" required autoComplete="off" placeholder={t('annex.titlePlaceholder')} />
      </div>
      <MarkdownEditor
        name="markdown"
        label={t('annex.text')}
        defaultValue=""
        isRequired
        placeholder={t('annex.textPlaceholder')}
      />
    </DocumentCreation>
  );
}

// Any file of the Profile under its own name; the action says why a name is refused
export function ProfileFileCreation() {
  const { t } = useTranslation('settings');
  const fileNameId = useId();
  return (
    <DocumentCreation
      intent="create"
      openLabel={t('profileFile.creationOpen')}
      submitLabel={t('profileFile.create')}
      successMessage={t('profileFile.created')}
    >
      <div className="grid gap-2">
        <Label htmlFor={fileNameId}>{t('profileFile.fileName')}</Label>
        <Input
          id={fileNameId}
          name="fileName"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder={t('profileFile.fileNamePlaceholder')}
          className="font-mono"
        />
      </div>
      <MarkdownEditor
        name="markdown"
        label={t('profileFile.creationContent')}
        defaultValue=""
        placeholder={t('profileFile.creationContentPlaceholder')}
      />
    </DocumentCreation>
  );
}
