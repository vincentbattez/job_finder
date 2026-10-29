# job_finder

Veille d'offres d'emploi et préparation des candidatures. Vocabulaire : `GLOSSARY.md`. Décisions : `docs/adr/`. Règles de code : `CODING_STANDARDS.md`.

## Installation

```bash
mise install                                   # Node 26, lefthook, gitleaks, puis npm install (et prisma generate) et les git hooks
mise run init                                  # crée data/config.json depuis l'exemple, à adapter ensuite, et remplit dev-data/
jf                                             # affiche l'aide
```

`jf` est sur le `PATH` dès que mise est actif dans le dossier du repo.

## Données

Tout vit dans `data/`, hors de git et sans sauvegarde :

- `config.json` : les Candidats, leurs Veilles et leur cible de notification, et le délai par défaut. Le modèle versionné est `config.example.json` ;
- `job_finder.sqlite` : la base, migrée à chaque lancement ;
- `candidats/<id>/profil/` : le Profil de chaque Candidat, en fichiers Markdown.

`dev-data/` a la même forme, avec des Offres factices pour le développement. Les commandes Prisma et les tasks `db:` ne touchent qu'à lui.

## Base de données

Le schéma est décrit dans `prisma/schema.prisma`, seule source à éditer. Après une modification, `mise run db:migrate` génère la migration dans `prisma/migrations/` et l'applique à `dev-data/`. Une migration générée ne s'édite pas à la main. `jf` applique les migrations en attente à `data/` à chaque lancement.

## Code

- `src/actions/` : la couche d'actions, seule source de vérité de chaque fonctionnalité. La CLI et le front ne font que l'appeler (ADR-0003). Les tests passent par elle.
- `src/cli/` : la CLI `jf`, qui relaie vers les actions.
- `src/web/` : le front React Router, qui relaie lui aussi vers les actions. `mise run web` le lance en développement, et `/design` montre ses composants avec des Offres d'exemple. Les couleurs, les polices et les espacements sont des tokens de `src/web/tokens.css`.
- `src/domain/` : les types domaine, tirés de leurs schémas Zod. Une fois passée l'anti-corruption layer, le code ne manipule qu'eux (ADR-0005).
- `src/workspace/` : l'accès au dossier de données (config, base, dossiers des Candidats). Seul son dossier `acl/` lit la config et la base. Le client Prisma est généré dans `generated/`, hors de git.
- `src/modules/` : un dossier par module, avec un seul point d'entrée. Un module n'en importe jamais un autre, ce que vérifie `test/architecture.test.ts`.
- `prisma/` : le schéma, les migrations et le seed.

## Commandes

| Commande              | Rôle                                                               |
| --------------------- | ------------------------------------------------------------------ |
| `mise run ci`         | Lint, typecheck et tests, comme la CI                              |
| `mise run lint`       | ESLint, Prettier, Knip, et les migrations à jour du schéma         |
| `mise run typecheck`  | TypeScript                                                         |
| `mise run test:unit`  | Vitest : les actions et l'architecture                             |
| `mise run test:e2e`   | Playwright : les parcours du front                                 |
| `mise run web`        | Lance le front en développement, ouvert au réseau local (ADR-0002) |
| `mise run db:migrate` | Crée une migration depuis le schéma et l'applique à `dev-data/`    |
| `mise run db:seed`    | Remplace les Offres de `dev-data/` par des Offres factices         |
| `mise run db:reset`   | Recrée la base de `dev-data/` depuis les migrations, puis la seed  |
