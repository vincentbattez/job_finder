import { useId, useState } from 'react';
import { Form } from 'react-router';

import type { Actions } from '#/actions/index.ts';

import { useIsHydrated } from './use-is-hydrated.ts';

type Rubrique = Awaited<ReturnType<Actions['readFaits']>>[number];

// A list rubrique, such as Diplômes: each entry is a field the Candidat adds or removes. Its key
// keeps each field with its text when an entry above it goes.
function ListRubrique({ title, example, entryList }: Readonly<Rubrique>) {
  const [entryItemList, setEntryItemList] = useState(() => entryList.map((entry, key) => ({ key, entry })));
  const isHydrated = useIsHydrated();
  return (
    <fieldset className="faits__rubrique">
      <legend>{title}</legend>
      {entryItemList.map(({ key, entry }, index) => (
        <div key={key} className="faits__entry">
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

// The Faits by rubrique, read from faits.md and written back into it; the rest of the file stays as
// written
export function FaitsForm({ rubriqueList }: Readonly<{ rubriqueList: Rubrique[] }>) {
  const headingId = useId();
  return (
    <section className="faits" aria-labelledby={headingId}>
      <h2 id={headingId}>Faits</h2>
      <p>Ce que vous avez validé sur vous-même, rubrique par rubrique. Le formulaire écrit dans faits.md.</p>
      <Form method="post" preventScrollReset>
        <input type="hidden" name="intent" value="faits" />
        {rubriqueList.map((rubrique) =>
          rubrique.isList ? (
            <ListRubrique key={rubrique.title} {...rubrique} />
          ) : (
            <label key={rubrique.title} className="faits__rubrique">
              {rubrique.title}
              <textarea
                name={rubrique.title}
                defaultValue={rubrique.entryList.join('\n\n')}
                rows={2}
                placeholder={rubrique.example}
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
