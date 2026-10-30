# i18next translates the tool, and a Locale Switcher sets the Locale

Spec #65 put every word a Candidate reads in an in-house typed catalogue, with no i18n library, and gave no screen to change the Locale: a Candidate's Locale was set once, at creation. Issue #79 reverses both. The copy goes through i18next (`i18next` and `react-i18next`), and the top bar of every page has a Locale Switcher, FR or EN. The catalogue had started to rebuild what i18next already does: plurals as hand-written conditions, dates through ad hoc formatters, interpolation as one function per entry. A library everyone knows, with its plural rules, its formatters and its typed keys, costs less than growing our own. And a Candidate who wants to read the tool in the other language should not have to ask Vincent.

- **Resources.** One i18next namespace per area (`common`, `postingList`, …), written in TypeScript in `src/domain/catalogue/{en,fr}/<area>.ts`: the `en` objects type i18next's `CustomTypeOptions`, and each `fr` object is typed against its `en` one, so a key missing on either side, or a `t` call with an unknown key, fails the typecheck. Interpolation is `{{name}}`, plurals are i18next's `_one` / `_other` suffixes, dates use i18next's `datetime` formatter with the Europe/Paris zone. An interchangeable module's copy stays in its folder (`src/modules/<module>/copy.ts`, ADR-0010): the module adds it as a namespace of its own with `addResources`, typed by augmenting i18next's `ResourceNamespaceMap`, so its name appears nowhere else.
- **One instance per Locale, its language fixed.** `src/domain/catalogue/i18n.ts` creates them with the resources bundled, ready synchronously; nothing ever calls `changeLanguage`. The CLI, the worker, the actions and the notifications take a `t` with `tFor(locale, namespace)`.
- **One rule for the Locale.** The chosen Candidate's Locale, else the `locale` cookie the Locale Switcher sets while no Candidate is chosen, else French (`localeOf`). The root loader resolves it for each request; the root layout wraps the page in react-i18next's `I18nextProvider` with that Locale's instance and sets `<html lang>`. The server renders in that Locale and the client hydrates in the same one: no flash of the other language.
- **The Locale Switcher** saves the Locale on the chosen Candidate (`setCandidateLocale`), so the CLI and the notifications follow it too; without a Candidate, in the cookie.

## Considered Options

- **Keep the in-house catalogue and only add the switcher.** Rejected: the catalogue's functions were reimplementing plurals and formatting, and every area added more of them.
- **remix-i18next and its React Router middleware**, the integration react-i18next's docs point to. Rejected for now: its language detector reads a cookie, the session or the `Accept-Language` header, never a Candidate's row, and it needs a custom `entry.server.tsx` and `entry.client.tsx` the front does not have. A provider fed by the root loader gives the same server render in the right language with a few lines.
- **JSON resource files.** Rejected: a JSON `fr` file cannot be typed against the `en` one, so a missing French key would only show at runtime.

## Consequences

- During the migration (#79), the areas not yet moved still go through the former catalogue (`catalogueOf`, `catalogueFor`, `useCatalogue`), which then follows the same Locale rule; it is deleted once empty.
- French plural rules (`Intl.PluralRules`) treat 0 as singular: a French copy that used the plural for 0 needs an explicit `_zero` key, in both locales since `fr` is typed against `en`.
