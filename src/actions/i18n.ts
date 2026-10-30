// The CLI, the front and the worker translate through the domain's i18next resources, reached
// through the actions only (ADR-0003, ADR-0012)
export { DEFAULT_LOCALE, i18nOf, localeOf, tFor } from '#/domain/catalogue/i18n.ts';
export type { Locale } from '#/domain/index.ts';
