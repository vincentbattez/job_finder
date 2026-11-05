import { cn } from 'cn';
import { FileUpIcon, XIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '#/web/components/ui/button.tsx';
import { Input } from '#/web/components/ui/input.tsx';
import { Label } from '#/web/components/ui/label.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';

type Scope = 'posting' | 'profile';

// A text file is read in the browser into the text, which the Candidate may still edit; a PDF is sent as it
// is, for the worker to convert into a document of the Posting
const FILE_ACCEPT = '.md,.mdx,.txt,.pdf,text/markdown,text/plain,application/pdf';

function ScopeOption({
  value,
  isSelected,
  isDisabled = false,
  title,
  description,
  onSelect,
}: Readonly<{
  value: Scope;
  isSelected: boolean;
  isDisabled?: boolean;
  title: string;
  description: string;
  onSelect: (scope: Scope) => void;
}>) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
        isSelected && 'border-primary bg-primary/5',
        isDisabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
      )}
    >
      <input
        type="radio"
        name="scope"
        value={value}
        checked={isSelected}
        disabled={isDisabled}
        onChange={() => {
          onSelect(value);
        }}
        className="mt-0.5 size-4 accent-primary"
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

// The fields of Add a document (spec #125, « Custom Artifacts and Annexes »): a title, a text
// typed or read from a text file or a PDF to convert, and where to keep it, for this Posting, or its Interview, or in the
// Profile as an Annex when the run reads the Profile
export function AddDocumentFields({
  interviewNumber,
  isAnnexAllowed,
}: Readonly<{ interviewNumber: number | null; isAnnexAllowed: boolean }>) {
  const { t } = useTranslation('posting');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [scope, setScope] = useState<Scope>('posting');
  const [pdfName, setPdfName] = useState<string | null>(null);
  const titleId = useId();
  const textId = useId();

  async function readFile(file: File) {
    if (title.trim() === '') {
      setTitle(file.name.replace(/\.[^.]+$/u, ''));
    }
    if (/\.pdf$/iu.test(file.name)) {
      // An Annex is a text of the Profile, whose PDFs are its Uploads: a PDF stays with the Posting
      setScope('posting');
      setPdfName(file.name);
      return;
    }
    setPdfName(null);
    setText(await file.text());
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <Label htmlFor={titleId}>{t('documents.titleLabel')}</Label>
        <Input
          id={titleId}
          name="title"
          required
          value={title}
          placeholder={t('documents.titlePlaceholder')}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={textId}>{t('documents.textLabel')}</Label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-primary underline-offset-4 hover:underline has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <FileUpIcon aria-hidden className="size-3.5" />
            {t('documents.filePrompt')}
            <input
              type="file"
              {...(pdfName !== null && { name: 'pdf' })}
              accept={FILE_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) {
                  void readFile(file);
                }
              }}
            />
          </label>
        </div>
        {pdfName === null ? (
          <Textarea
            id={textId}
            name="text"
            required
            rows={8}
            value={text}
            placeholder={t('documents.textPlaceholder')}
            className="field-sizing-fixed max-h-72"
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        ) : (
          <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{pdfName}</span>
              <span className="block text-xs text-muted-foreground">{t('documents.pdfHint')}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('documents.pdfRemove')}
              onClick={() => {
                setPdfName(null);
              }}
            >
              <XIcon aria-hidden />
            </Button>
          </div>
        )}
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium">{t('documents.scopeLegend')}</legend>
        <ScopeOption
          value="posting"
          isSelected={scope === 'posting'}
          title={
            interviewNumber === null
              ? t('documents.scopePosting')
              : t('documents.scopeInterview', { number: interviewNumber })
          }
          description={interviewNumber === null ? t('documents.scopePostingHint') : t('documents.scopeInterviewHint')}
          onSelect={setScope}
        />
        <ScopeOption
          value="profile"
          isSelected={scope === 'profile'}
          isDisabled={!isAnnexAllowed || pdfName !== null}
          title={t('documents.scopeProfile')}
          description={isAnnexAllowed ? t('documents.scopeProfileHint') : t('documents.scopeProfileUnavailable')}
          onSelect={setScope}
        />
      </fieldset>
    </div>
  );
}
