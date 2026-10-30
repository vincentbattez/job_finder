import { z } from 'zod/v4';

import { DEFAULT_LOCALE } from '#/domain/catalogue/index.ts';
import {
  PARAMETER_SCHEMA,
  PARAMETERS_SCHEMA,
  type Locale,
  type LocalizedText,
  type Parameter,
  type Parameters,
} from '#/domain/index.ts';

// How each family of interchangeable modules declares its Parameters, so that the front builds its
// form from the descriptor of a module (ADR-0010)

// How the front shows a Parameter: a list takes several values, such as the courts of appeal of a
// Zone. A secret one is write-only: no action returns it (ADR-0006).
interface IParameterMeta {
  label: LocalizedText;
  placeholder?: LocalizedText;
  type?: 'text' | 'url' | 'list';
  isSecret?: boolean;
}

const PARAMETER_REGISTRY = z.registry<IParameterMeta>();

// Declares a Parameter of a module: its schema, optional or not, and how the front shows it
export function parameter<T extends z.ZodType>(schema: T, meta: IParameterMeta): T {
  PARAMETER_REGISTRY.add(schema, meta);
  return schema;
}

export type ParameterShape = Record<string, z.ZodType>;

export type ParametersOf<TShape extends ParameterShape> = z.output<z.ZodObject<TShape>>;

// Each Parameter of a module as the front builds its field. A Parameter is required when its schema
// refuses it missing, and has choices when the module lists them.
function describeParameters(
  moduleName: string,
  parameterSchema: z.ZodObject<ParameterShape>,
  choiceNameList: readonly string[] = [],
): Parameter[] {
  return Object.entries(parameterSchema.shape).map(([parameterName, schema]) => {
    const meta = PARAMETER_REGISTRY.get(schema);
    if (meta === undefined) {
      throw new Error(`Le Paramètre ${parameterName} du module ${moduleName} n'est pas déclaré par parameter().`);
    }
    return PARAMETER_SCHEMA.parse({
      name: parameterName,
      label: meta.label,
      placeholder: meta.placeholder ?? null,
      type: meta.type ?? 'text',
      isRequired: !schema.safeParse(undefined).success,
      isSecret: meta.isSecret ?? false,
      hasChoices: choiceNameList.includes(parameterName),
    });
  });
}

// The Parameters of a module of either family: their description, from which the front builds the
// form, and their parsing with the module's own schema, since the database keeps them as JSON
// (ADR-0010). When some are missing or wrong, the error names them in the words of the form.
export function declareParameters<TShape extends ParameterShape>(
  moduleName: string,
  parameterSchema: z.ZodObject<TShape>,
  choiceNameList: readonly string[] = [],
) {
  const parameterList = describeParameters(moduleName, parameterSchema, choiceNameList);
  // The error a module gives when some Parameters are missing or wrong, given their labels
  type MessageComposer = (labelList: string) => string;

  function parseWith<T extends z.ZodType>(schema: T, rawParameters: unknown, composeMessage: MessageComposer) {
    const result = schema.safeParse(rawParameters);
    if (!result.success) {
      const labelList = result.error.issues.map((issue) => labelOf(parameterList, issue.path[0]));
      throw new Error(composeMessage([...new Set(labelList)].map((label) => `« ${label} »`).join(', ')));
    }
    return result.data;
  }

  return {
    parameterList,
    parse: (rawParameters: unknown, composeMessage: MessageComposer) =>
      parseWith(parameterSchema, rawParameters, composeMessage),
    // What the Candidate typed, to try it: each Parameter may be missing
    parseTrial: (rawParameters: unknown, composeMessage: MessageComposer) =>
      parseWith(parameterSchema.partial(), rawParameters, composeMessage),
    // As the database keeps them
    parseToSave: (rawParameters: unknown, composeMessage: MessageComposer): Parameters =>
      PARAMETERS_SCHEMA.parse(parseWith(parameterSchema, rawParameters, composeMessage)),
  };
}

// French by default, as the error messages that name a Parameter are until they take the Candidate's locale
export function labelOf(
  parameterList: readonly Parameter[],
  parameterName: PropertyKey | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return parameterList.find(({ name }) => name === parameterName)?.label[locale] ?? String(parameterName);
}
