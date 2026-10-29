# Prisma pour la base SQLite, avec migrations et seed

La base SQLite est décrite par `prisma/schema.prisma`, seule source qu'on édite. Prisma en dérive le client typé et les migrations (`prisma migrate dev`), versionnées dans `prisma/migrations/`. À chaque lancement, l'application applique à `data/` les migrations en attente (`prisma migrate deploy`) : mettre à jour le code ne demande aucune étape à la main. Un seed faker remplit `dev-data/` d'Offres factices, pour développer sans toucher aux vraies données.

Ce choix remplace la ligne du PRD (#1) « `node:sqlite` : pas d'ORM, pas de dépendance native ». Le schéma va changer à chaque tranche alors que `data/` contiendra déjà les Offres de Léa. Des migrations générées depuis un schéma déclaratif coûtent moins cher que des migrations écrites à la main.

## Considered Options

- **`node:sqlite` et du SQL écrit à la main** (le choix initial du PRD). Aucune dépendance, mais il fallait écrire soi-même le mécanisme de migration (`PRAGMA user_version` et des scripts SQL), valider chaque ligne lue avec Zod, et écrire à la main les données de développement.

## Consequences

- Deux dépendances natives arrivent : `better-sqlite3`, via l'adaptateur Prisma, et le moteur de migration de Prisma. `package.json#allowScripts` autorise leurs scripts d'installation.
- `npm install` génère le client dans `src/workspace/generated/`, hors de git. Les types Prisma ne sortent pas de `src/workspace/acl/`, qui convertit chaque ligne en type domaine (ADR-0005).
- Chaque lancement de `jf` paie environ 0,3 s pour `prisma migrate deploy`.
- SQLite ne vérifie plus les valeurs des enums (statut d'une Offre, état d'une Version ou d'un job) : c'est Prisma qui les contrôle.
- Les commandes Prisma et les tasks `db:` ne touchent qu'à `dev-data/`. Une migration générée ne s'édite pas à la main, et la CI échoue si le schéma a changé sans migration.
