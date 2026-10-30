import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form } from 'react-router';

import type { Actions } from '#/actions/index.ts';

import { useIsHydrated } from './use-is-hydrated.ts';

import './facts-form.css';

type Section = Awaited<ReturnType<Actions['readFacts']>>[number];

// A list section, such as Diplômes: each entry is a field the Candidate adds or removes. Its key
// keeps each field with its text when an entry above it goes.
function ListSection({ title, example, entryList }: Readonly<Section>) {
  const [entryItemList, setEntryItemList] = useState(() => entryList.map((entry, key) => ({ key, entry })));
  const isHydrated = useIsHydrated();
  const { t } = useTranslation('settings');
  return (
    <fieldset className="facts-form__section">
      <legend>{title}</legend>
      {entryItemList.map(({ key, entry }, index) => (
        <div key={key} className="facts-form__entry">
          <label>
            {t('facts.entry', { number: index + 1 })}
            <textarea name={title} defaultValue={entry} rows={2} placeholder={example} />
          </label>
          <button
            className="button"
            type="button"
            disabled={!isHydrated}
            aria-label={t('facts.deleteEntry', { number: index + 1 })}
            onClick={() => {
              setEntryItemList(entryItemList.filter((entryItem) => entryItem.key !== key));
            }}
          >
            {t('facts.delete')}
          </button>
        </div>
      ))}
      <button
        className="button facts-form__add"
        type="button"
        disabled={!isHydrated}
        onClick={() => {
          const key = Math.max(-1, ...entryItemList.map((entryItem) => entryItem.key)) + 1;
          setEntryItemList([...entryItemList, { key, entry: '' }]);
        }}
      >
        {t('facts.add')}
      </button>
    </fieldset>
  );
}

// The Facts by section, read from facts.md and written back into it; the rest of the file stays as
// written
export function FactsForm({ sectionList }: Readonly<{ sectionList: Section[] }>) {
  const headingId = useId();
  const { t } = useTranslation('settings');
  return (
    <section className="facts-form" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('facts.heading')}</h2>
      <p>{t('facts.intro')}</p>
      <Form method="post" preventScrollReset>
        <input type="hidden" name="intent" value="facts" />
        {sectionList.map((section) =>
          section.isList ? (
            <ListSection key={section.title} {...section} />
          ) : (
            <label key={section.title} className="facts-form__section">
              {section.title}
              <textarea
                name={section.title}
                defaultValue={section.entryList.join('\n\n')}
                rows={2}
                placeholder={section.example}
              />
            </label>
          ),
        )}
        <div className="facts-form__actions">
          <button type="submit" className="button button--primary">
            {t('facts.save')}
          </button>
        </div>
      </Form>
    </section>
  );
}
