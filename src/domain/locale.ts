// The languages a Candidate reads the interface in: the one list the schema, the i18next instances and
// the Locale Switcher derive from (ADR-0012). Without zod, so the front's bundle may import it.
export const LOCALE_LIST = ['fr', 'en'] as const;

export type Locale = (typeof LOCALE_LIST)[number];
