import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';

type Parameter = Awaited<ReturnType<Actions['listSources']>>[number]['parameterList'][number];

// The name of a Parameter's field, apart from the fields of the form itself, such as the intent
export const PARAMETER_FIELD_PREFIX = 'parameters.';

// The value a field shows: a list Parameter one value per line, such as the courts of appeal of a Zone
function valueOf(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string').join('\n');
  }
  return typeof value === 'string' ? value : '';
}

// A Parameter typed in, the field built from the descriptor of its module (ADR-0010). A secret one
// always starts empty: it is write-only, and left empty it keeps the saved one (ADR-0006).
export function ParameterField({
  parameter: { name, label, placeholder: placeholderOrNull, type, isRequired, isSecret },
  savedValue,
  className,
  isConfigured = false,
  secretReference,
}: Readonly<{
  parameter: Parameter;
  savedValue: unknown;
  className: string;
  isConfigured?: boolean;
  secretReference?: (input: HTMLInputElement | null) => void;
}>) {
  const { t } = useTranslation('settings');
  // The loader read the module's texts in the locale (translateParameters)
  const placeholder = placeholderOrNull ?? '';
  const fieldName = `${PARAMETER_FIELD_PREFIX}${name}`;
  if (isSecret) {
    return (
      <label className={className}>
        <span>
          {label}
          {isConfigured && <span className="parameter-field__configured">{t('parameter.configured')}</span>}
        </span>
        <input
          ref={secretReference}
          type="password"
          name={fieldName}
          autoComplete="off"
          placeholder={isConfigured ? t('parameter.keepSaved') : placeholder}
        />
      </label>
    );
  }
  if (type === 'list') {
    return (
      <label className={className}>
        {t('parameter.onePerLine', { label })}
        <textarea
          name={fieldName}
          rows={3}
          required={isRequired}
          defaultValue={valueOf(savedValue)}
          placeholder={placeholder}
        />
      </label>
    );
  }
  return (
    <label className={className}>
      {label}
      <input
        type={type}
        name={fieldName}
        required={isRequired}
        defaultValue={valueOf(savedValue)}
        placeholder={placeholder}
      />
    </label>
  );
}
