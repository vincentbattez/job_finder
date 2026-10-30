import type { Actions } from '#/actions/index.ts';
import { PARAMETER_FIELD_PREFIX } from '#/web/components/parameter-field.tsx';

type Parameter = Awaited<ReturnType<Actions['listSources']>>[number]['parameterList'][number];

// The Parameters of a form built from the descriptor of a module (ADR-0010), each field named after
// its Parameter: a list one value per line, as the descriptor says
export function readParameters(formData: FormData, parameterList: readonly Parameter[] = []) {
  const listNameSet = new Set(parameterList.filter(({ type }) => type === 'list').map(({ name }) => name));
  return Object.fromEntries(
    [...formData]
      .filter(([fieldName]) => fieldName.startsWith(PARAMETER_FIELD_PREFIX))
      .map(([fieldName, value]) => {
        const name = fieldName.slice(PARAMETER_FIELD_PREFIX.length);
        const text = typeof value === 'string' ? value.trim() : '';
        return [name, listNameSet.has(name) ? text.split('\n').map((line) => line.trim()) : text];
      }),
  );
}
