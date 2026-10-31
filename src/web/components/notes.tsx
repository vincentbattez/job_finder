import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ButtonRow } from './button-row.tsx';
import { MarkdownEditor } from './markdown-editor.tsx';

import './notes.css';

// The free Notes of a Posting, whatever its Status, inside the form its Container saves them with
export function Notes({
  notes,
  error,
  renderForm,
}: Readonly<{ notes: string; error: string | null | undefined; renderForm: (fieldList: ReactNode) => ReactNode }>) {
  const headingId = useId();
  const [editedNotes, setEditedNotes] = useState(notes);
  const { t } = useTranslation('posting');
  return (
    <section className="notes" id="notes" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('notes.heading')}</h2>
      {renderForm(
        <>
          <MarkdownEditor
            label={t('notes.label')}
            name="notes"
            defaultValue={notes}
            placeholder={t('notes.placeholder')}
            onChange={setEditedNotes}
          />
          <ButtonRow>
            <button type="submit" className="button button--primary">
              {t('notes.save')}
            </button>
            {editedNotes !== notes && <p role="status">{t('unsavedChanges')}</p>}
            {error != null && <p role="alert">{error}</p>}
          </ButtonRow>
        </>,
      )}
    </section>
  );
}
