import { textOf, type Locale } from '#/actions/i18n.ts';
import type { Actions } from '#/actions/index.ts';
import { PARAMETER_FIELD_PREFIX } from '#/web/components/parameter-field.tsx';

type Parameter = Awaited<ReturnType<Actions['listSources']>>[number]['parameterList'][number];

// The Parameters of a form built from the descriptor of a module (ADR-0010), each field named after
// its Parameter
export function readParameters(formData: FormData) {
  return Object.fromEntries(
    [...formData]
      .filter(([fieldName]) => fieldName.startsWith(PARAMETER_FIELD_PREFIX))
      .map(([fieldName, value]) => {
        return [fieldName.slice(PARAMETER_FIELD_PREFIX.length), typeof value === 'string' ? value.trim() : ''];
      }),
  );
}

// A module's descriptor with its Parameter texts read in the locale: they are keys of the module's own
// namespace, which only the server loads, never the front's bundle (ADR-0010, ADR-0012)
export function translateParameters<TModule extends { parameterList: readonly Parameter[] }>(
  moduleList: readonly TModule[],
  locale: Locale,
): TModule[] {
  return moduleList.map((module) => ({
    ...module,
    parameterList: module.parameterList.map((parameter) => ({
      ...parameter,
      label: textOf(locale, parameter.label),
      placeholder: parameter.placeholder === null ? null : textOf(locale, parameter.placeholder),
    })),
  }));
}
