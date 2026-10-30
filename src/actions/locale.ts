import { LOCALE_SCHEMA, type Locale } from '#/domain/index.ts';

// The locale a visitor sent, through the Locale Switcher or the front's cookie: null when it is not one
// of the tool's (ADR-0012). Server side only: it keeps Zod out of the front's bundle.
export function parseLocale(rawLocale: unknown): Locale | null {
  const result = LOCALE_SCHEMA.safeParse(rawLocale);
  return result.success ? result.data : null;
}
