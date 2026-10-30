import { useId, useState } from 'react';
import { Form } from 'react-router';

import type { Actions } from '#/actions/index.ts';

import { useIsHydrated } from './use-is-hydrated.ts';

type Section = Awaited<ReturnType<Actions['readFacts']>>[number];

// A list section, such as Diplômes: each entry is a field the Candidate adds or removes. Its key
// keeps each field with its text when an entry above it goes.
function ListSection({ title, example, entryList }: Readonly<Section>) {
  const [entryItemList, setEntryItemList] = useState(() => entryList.map((entry, key) => ({ key, entry })));
  const isHydrated = useIsHydrated();
  return (
    <fieldset className="facts__section">
      <legend>{title}</legend>
      {entryItemList.map(({ key, entry }, index) => (
        <div key={key} className="facts__entry">
          <label>
            Entrée {index + 1}
            <textarea name={title} defaultValue={entry} rows={2} placeholder={example} />
          </label>
          <button
            type="button"
            disabled={!isHydrated}
            aria-label={`Supprimer l’entrée ${String(index + 1)}`}
            onClick={() => {
              setEntryItemList(entryItemList.filter((entryItem) => entryItem.key !== key));
            }}
          >
            Supprimer
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={!isHydrated}
        onClick={() => {
          const key = Math.max(-1, ...entryItemList.map((entryItem) => entryItem.key)) + 1;
          setEntryItemList([...entryItemList, { key, entry: '' }]);
        }}
      >
        Ajouter
      </button>
    </fieldset>
  );
}

// The Facts by section, read from facts.md and written back into it; the rest of the file stays as
// written
export function FactsForm({ sectionList }: Readonly<{ sectionList: Section[] }>) {
  const headingId = useId();
  return (
    <section className="facts" aria-labelledby={headingId}>
      <h2 id={headingId}>Faits</h2>
      <p>Ce que vous avez validé sur vous-même, rubrique par rubrique. Le formulaire écrit dans facts.md.</p>
      <Form method="post" preventScrollReset>
        <input type="hidden" name="intent" value="facts" />
        {sectionList.map((section) =>
          section.isList ? (
            <ListSection key={section.title} {...section} />
          ) : (
            <label key={section.title} className="facts__section">
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
        <div className="edition">
          <button type="submit" className="button--primary">
            Enregistrer les Faits
          </button>
        </div>
      </Form>
    </section>
  );
}
