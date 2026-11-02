import { SaveIcon } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '#/web/components/ui/button.tsx';
import { Textarea } from '#/web/components/ui/textarea.tsx';

// The free Notes of a Posting, whatever its Status, inside the form its Container saves them with
export function Notes({
  notes,
  isPending,
  renderForm,
}: Readonly<{ notes: string; isPending: boolean; renderForm: (fieldList: ReactNode) => ReactNode }>) {
  const headingId = useId();
  const fieldId = useId();
  const [editedNotes, setEditedNotes] = useState(notes);
  const [savedNotes, setSavedNotes] = useState(notes);
  const { t } = useTranslation('posting');
  // Saved elsewhere, such as in the Sheet, the Notes show what was saved
  if (notes !== savedNotes) {
    setSavedNotes(notes);
    setEditedNotes(notes);
  }
  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-[72ch] space-y-3">
      <h2 id={headingId} className="sr-only">
        {t('notes.heading')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('notes.intro')}</p>
      {renderForm(
        <>
          <label htmlFor={fieldId} className="sr-only">
            {t('notes.label')}
          </label>
          <Textarea
            id={fieldId}
            name="notes"
            value={editedNotes}
            placeholder={t('notes.placeholder')}
            onChange={(event) => {
              setEditedNotes(event.target.value);
            }}
            className="min-h-[50vh] resize-y bg-card"
          />
          <div className="mt-3 flex items-center justify-end gap-3">
            {editedNotes !== notes && (
              <p role="status" className="text-xs text-muted-foreground">
                {t('unsavedChanges')}
              </p>
            )}
            <Button type="submit" size="sm" isPending={isPending} disabled={editedNotes === notes}>
              <SaveIcon />
              {t('notes.save')}
            </Button>
          </div>
        </>,
      )}
    </section>
  );
}
