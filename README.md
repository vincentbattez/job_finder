# job_finder

Veille d'offres d'emploi et préparation des candidatures. Vocabulaire : `GLOSSARY.md`. Décisions : `docs/adr/`.

## Installation

```bash
mise install                                   # Node 26, lefthook, gitleaks, puis npm install et les git hooks
mise run init                                  # crée data/config.json depuis l'exemple, à adapter ensuite
jf                                             # affiche l'aide
```

`jf` est sur le `PATH` dès que mise est actif dans le dossier du repo.

## Données

Tout vit dans `data/`, hors de git et sans sauvegarde :

- `config.json` : les Candidats, leurs Veilles et leur cible de notification, et le délai par défaut. Le modèle versionné est `config.example.json` ;
- `job_finder.sqlite` : la base, créée au premier lancement ;
- `candidats/<id>/profil/` : le Profil de chaque Candidat, en fichiers Markdown.

## Code

- `src/actions/` : la couche d'actions, seule source de vérité de chaque fonctionnalité. La CLI et le front ne font que l'appeler (ADR-0003). Les tests passent par elle.
- `src/cli/` : la CLI `jf`, qui relaie vers les actions.
- `src/workspace/` : l'accès au dossier `data/` (config, base SQLite, dossiers des Candidats).
- `src/modules/` : un dossier par module, avec un seul point d'entrée. Un module n'en importe jamais un autre, ce que vérifie `test/architecture.test.ts`.

## Commandes

| Commande             | Rôle                                        |
| -------------------- | ------------------------------------------- |
| `mise run ci`        | Lint, typecheck et tests, comme la CI       |
| `mise run lint`      | ESLint, Prettier et Knip                    |
| `mise run typecheck` | TypeScript                                  |
| `mise run test:unit` | Vitest : les actions et l'architecture      |
| `mise run test:e2e`  | Playwright : les parcours du front (dès L2) |
