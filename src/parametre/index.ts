import { z } from 'zod/v4';

import { PARAMETRE_SCHEMA, type Parametre } from '#/domain/index.ts';

// How each family of interchangeable modules declares its Paramètres, so that the front builds its
// form from the descriptor of a module (ADR-0010)

// How the front shows a Paramètre: a list takes several values, such as the courts of appeal of a
// Zone. A secret one is write-only: no action returns it (ADR-0006).
interface IParametreMeta {
  label: string;
  placeholder?: string;
  type?: 'text' | 'url' | 'list';
  isSecret?: boolean;
}

const PARAMETRE_REGISTRY = z.registry<IParametreMeta>();

// Declares a Paramètre of a module: its schema, optional or not, and how the front shows it
export function parametre<T extends z.ZodType>(schema: T, meta: IParametreMeta): T {
  PARAMETRE_REGISTRY.add(schema, meta);
  return schema;
}

export type ParametreShape = Record<string, z.ZodType>;

export type ParametresOf<TShape extends ParametreShape> = z.output<z.ZodObject<TShape>>;

// Each Paramètre of a module as the front builds its field. A Paramètre is required when its schema
// refuses it missing, and has choices when the module lists them.
export function describeParametres(
  moduleName: string,
  parametreSchema: z.ZodObject<ParametreShape>,
  choiceNameList: readonly string[] = [],
): Parametre[] {
  return Object.entries(parametreSchema.shape).map(([parametreName, schema]) => {
    const meta = PARAMETRE_REGISTRY.get(schema);
    if (meta === undefined) {
      throw new Error(`Le Paramètre ${parametreName} du module ${moduleName} n'est pas déclaré par parametre().`);
    }
    return PARAMETRE_SCHEMA.parse({
      name: parametreName,
      label: meta.label,
      placeholder: meta.placeholder ?? null,
      type: meta.type ?? 'text',
      isRequired: !schema.safeParse(undefined).success,
      isSecret: meta.isSecret ?? false,
      hasChoices: choiceNameList.includes(parametreName),
    });
  });
}

// Parses Paramètres with the schema of their module; when some are missing or wrong, the error names
// them in the words of the form
export function parseParametres<T extends z.ZodType>(
  schema: T,
  rawParametres: unknown,
  parametreList: readonly Parametre[],
  composeMessage: (labelList: string) => string,
): z.infer<T> {
  const result = schema.safeParse(rawParametres);
  if (!result.success) {
    const labelList = result.error.issues.map((issue) => labelOf(parametreList, issue.path[0]));
    throw new Error(composeMessage([...new Set(labelList)].map((label) => `« ${label} »`).join(', ')));
  }
  return result.data;
}

export function labelOf(parametreList: readonly Parametre[], parametreName: PropertyKey | undefined): string {
  return parametreList.find(({ name }) => name === parametreName)?.label ?? String(parametreName);
}
