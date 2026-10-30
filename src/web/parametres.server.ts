import type { Actions } from '#/actions/index.ts';
import { PARAMETRE_FIELD_PREFIX } from '#/web/components/parametre-field.tsx';

type Parametre = Awaited<ReturnType<Actions['listSources']>>[number]['parametreList'][number];

// The Paramètres of a form built from the descriptor of a module (ADR-0010), each field named after
// its Paramètre: a list one value per line, as the descriptor says
export function readParametres(formData: FormData, parametreList: readonly Parametre[] = []) {
  const listNameSet = new Set(parametreList.filter(({ type }) => type === 'list').map(({ name }) => name));
  return Object.fromEntries(
    [...formData]
      .filter(([fieldName]) => fieldName.startsWith(PARAMETRE_FIELD_PREFIX))
      .map(([fieldName, value]) => {
        const name = fieldName.slice(PARAMETRE_FIELD_PREFIX.length);
        const text = typeof value === 'string' ? value.trim() : '';
        return [name, listNameSet.has(name) ? text.split('\n').map((line) => line.trim()) : text];
      }),
  );
}
