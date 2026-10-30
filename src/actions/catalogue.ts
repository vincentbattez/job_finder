// The CLI and the front take their copy from the domain's catalogue through the actions only
// (ADR-0003)
export { catalogueOf, localeOf, type Catalogue } from '#/domain/catalogue/index.ts';
export type { Locale } from '#/domain/index.ts';
