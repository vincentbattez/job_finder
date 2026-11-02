import { CheckIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { Actions } from '#/actions/index.ts';
import { Badge } from '#/web/components/ui/badge.tsx';
import { Input } from '#/web/components/ui/input.tsx';
import { Label } from '#/web/components/ui/label.tsx';

type Parameter = Awaited<ReturnType<Actions['listSources']>>[number]['parameterList'][number];

// The name of a Parameter's field, apart from the fields of the form itself, such as the intent
export const PARAMETER_FIELD_PREFIX = 'parameters.';

// The value a field shows
function valueOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// A Parameter typed in, the field built from the descriptor of its module (ADR-0010). A secret one
// always starts empty: it is write-only, and left empty it keeps the saved one (ADR-0006).
export function ParameterField({
  parameter: { name, label, placeholder: placeholderOrNull, type, isRequired, isSecret },
  savedValue,
  isConfigured = false,
  secretReference,
}: Readonly<{
  parameter: Parameter;
  savedValue: unknown;
  isConfigured?: boolean;
  secretReference?: (input: HTMLInputElement | null) => void;
}>) {
  const { t } = useTranslation('settings');
  const fieldId = useId();
  // The loader read the module's texts in the locale (translateParameters)
  const placeholder = placeholderOrNull ?? '';
  const fieldName = `${PARAMETER_FIELD_PREFIX}${name}`;
  if (isSecret) {
    return (
      <div className="grid gap-2">
        <Label htmlFor={fieldId}>
          {label}
          {isConfigured && (
            <Badge variant="secondary" className="bg-validated/10 text-validated-foreground">
              <CheckIcon aria-hidden />
              {t('parameter.configured')}
            </Badge>
          )}
        </Label>
        <Input
          id={fieldId}
          ref={secretReference}
          type="password"
          name={fieldName}
          autoComplete="off"
          placeholder={isConfigured ? t('parameter.keepSaved') : placeholder}
        />
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        type={type}
        name={fieldName}
        required={isRequired}
        defaultValue={valueOf(savedValue)}
        placeholder={placeholder}
      />
    </div>
  );
}
