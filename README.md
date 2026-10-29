# job_finder

Veille d'offres d'emploi et préparation des candidatures. Vocabulaire : `GLOSSARY.md`. Décisions : `docs/adr/`. Règles de code : `CODING_STANDARDS.md`.

## Installation

```bash
mise install                                   # Node 26, lefthook, gitleaks, puis npm install (et prisma generate) et les git hooks
mise run init                                  # crée data/config.json depuis l'exemple, à adapter ensuite, et remplit dev-data/
cp .env.example .env                           # puis y renseigner l'URL et le token de Home Assistant, pour les notifications
jf                                             # affiche l'aide
jf detect                                      # cherche les nouvelles Offres de chaque Veille
jf list lea                                    # liste les Offres d'un Candidat, avec leur statut et celles qui sont Expirées
jf postuler 2026-2445600                       # passe une Offre en Postulée, ce qui fige sa Lettre ; jf archiver l'archive
jf run recherche 2026-2445600                  # met en file une nouvelle Version de la Recherche d'une Offre ; --wait attend que le worker l'ait produite
jf run lettre 2026-2445600                     # met en file une nouvelle Version de la Lettre, sur la Recherche retenue
jf destinataires 2026-2445600                  # affiche à qui adresser la candidature, selon la Lettre retenue
jf versions 2026-2445600 recherche             # liste les Versions d'un Artefact
jf retenir 2026-2445600 recherche 1            # change la Version retenue
jf edit 2026-2445600 recherche                 # corrige la Version retenue d'un Artefact avec Claude Code ; sans argument, propose les Offres puis l'Artefact
```

`jf` est sur le `PATH` dès que mise est actif dans le dossier du repo.

## Worker

Lancer un module ne fait que mettre son job en file. Le worker, service lpm `worker` déclaré dans `.lpm.yml` (`mise run worker`), exécute les jobs de `data/` un par un, donc une seule session Claude à la fois, dans son propre processus : redémarrer le front ne coupe pas une session (ADR-0003). Un job interrompu par un arrêt du worker passe « en échec » à son redémarrage, et se relance avec `jf run`. Une nouvelle Offre détectée dans la Zone met sa Recherche en file, sauf au premier lancement.

## Détection quotidienne

L'automation lpm `detect`, déclarée dans `.lpm.yml`, lance `jf detect` chaque jour à 18:00 (ADR-0003). Son run affiche « aucune nouvelle Offre » ou la liste des nouvelles Offres. Une Détection en échec sort en erreur : lpm marque le run « needs a look » et notifie. `.lpm.yml` se vérifie avec `lpm config validate .lpm.yml`.

## Notifications

Le Candidat est notifié sur son téléphone :

- d'une nouvelle Offre dans sa Zone, avec son titre, sa juridiction et sa Date limite. Rien n'est envoyé au premier lancement, ni quand la Détection ne trouve rien ;
- d'une Recherche prête, quand le worker l'a produite.

Le seul canal est Home Assistant. La cible de chaque Candidat est le service `notify.mobile_app_*` de son téléphone, dans `data/config.json`. L'URL de Home Assistant et un token longue durée (profil Home Assistant, onglet Sécurité) vont dans `.env`, hors de git, sur le modèle de `.env.example`. `jf` et le worker le lisent au lancement. Une notification qui ne part pas fait échouer la commande, ou arrête le worker, avec un message qui dit quoi vérifier : relancer le worker une fois le problème réglé.

## Données

Tout vit dans `data/`, hors de git et sans sauvegarde :

- `config.json` : les Candidats, leurs Veilles et leur cible de notification, et le délai par défaut. Le modèle versionné est `config.example.json` ;
- `job_finder.sqlite` : la base, migrée à chaque lancement ;
- `candidats/<id>/profil/` : le Profil de chaque Candidat, en fichiers Markdown : `faits.md`, `cv.md` et une `lettre-<employeur>-<année>.md` par lettre passée. `jf profil <candidat>` les écrit et les complète au fil d'une session Claude Code interactive ;
- `candidats/<id>/offres/<référence>-<titre>/` : un dossier par Offre, avec sa Fiche de poste (`fiche-de-poste.md`) sauvegardée dès la Détection, et un dossier par Version de chaque Artefact, par exemple `recherche/v2/recherche.md`. Une Version de la Lettre (`lettre/v<n>/`) contient le Brouillon (`brouillon.md`, en lecture seule), la Lettre à corriger (`lettre.md`, d'abord sa copie) et les destinataires recommandés (`destinataires.json`) ;
- `candidats/<id>/consignes/<artefact>.md` : les Consignes d'un module que le Candidat a remplacées, par exemple `recherche.md`. Sans ce fichier, le module suit ses Consignes par défaut.

`dev-data/` a la même forme, avec des Offres factices pour le développement. Les commandes Prisma et les tasks `db:` ne touchent qu'à lui.

## Base de données

Le schéma est décrit dans `prisma/schema.prisma`, seule source à éditer. Après une modification, `mise run db:migrate` génère la migration dans `prisma/migrations/` et l'applique à `dev-data/`. Une migration générée ne s'édite pas à la main. `jf` applique les migrations en attente à `data/` à chaque lancement.

## Code

- `src/actions/` : la couche d'actions, seule source de vérité de chaque fonctionnalité. La CLI et le front ne font que l'appeler (ADR-0003). Les tests passent par elle.
- `src/cli/` : la CLI `jf`, qui relaie vers les actions.
- `src/worker/` : le worker, qui relaie lui aussi vers les actions : il vide la file de jobs. Seul lui exécute les jobs, ce que vérifie `test/architecture.test.ts`.
- `src/web/` : le front React Router, qui relaie lui aussi vers les actions. `mise run web` le lance en développement, et `/design` montre ses composants avec des Offres d'exemple. Les couleurs, les polices et les espacements sont des tokens de `src/web/tokens.css`.
- `src/domain/` : les types domaine, tirés de leurs schémas Zod. Une fois passée l'anti-corruption layer, le code ne manipule qu'eux (ADR-0005).
- `src/workspace/` : l'accès au dossier de données (config, base, dossiers des Candidats). Seul son dossier `acl/` lit la config et la base. Le client Prisma est généré dans `generated/`, hors de git.
- `src/ai-session/` : le lancement des sessions d'IA. Seul `acl/claude-code.ts` sait qu'elles tournent sur Claude Code, toujours sur l'abonnement (`claude -p`, sans clé API) ; les tests le remplacent par un faux.
- `src/actions/run-job.ts` : l'exécution d'un job d'un module IA : la Version, le prompt en deux parties (partie fixe et Consignes), la vérification du fichier produit et la Version retenue.
- `src/profil/` : le prompt fixe de `jf profil`.
- `src/edit/` : le prompt fixe de `jf edit`, qui ouvre une session dans le dossier de l'Offre, sans shell ni web, où aucun Brouillon ne peut être modifié.
- `src/statut/` : les règles du statut d'une Offre : le calcul d'Expirée, et le gel de la Lettre retenue d'une Offre Postulée.
- `src/modules/` : un dossier par module, avec un seul point d'entrée. Un module n'en importe jamais un autre, ce que vérifie `test/architecture.test.ts`. Un module IA, comme `recherche/`, a sa partie fixe du prompt dans `prompt.ts` et ses Consignes par défaut dans `consignes.ts`.
- `src/modules/notification/` : le texte de chaque notification, et l'interface commune aux canaux. Seul `acl/home-assistant.ts` sait appeler Home Assistant.
- `prisma/` : le schéma, les migrations et le seed.
- `test/fixtures/pep/` : les réponses du site PEP enregistrées le 2026-10-29, que `test/recorded-http.ts` sert aux tests à la place du vrai site.
- `test/fake-notification-channel.ts` : le faux canal de notification, qui garde les notifications au lieu de les envoyer. Les tests ne lisent jamais `.env`, et `vitest.config.ts` vide les réglages de Home Assistant : un test sans le faux canal échoue au lieu d'envoyer une vraie notification.
- `test/fake-ai-session.ts` : le faux lancement de Claude, qui écrit l'Artefact prévu et garde le prompt reçu. `test/fixtures/claude/claude` remplace le binaire `claude` pour tester le vrai lancement sans ouvrir de session.

## Commandes

| Commande              | Rôle                                                               |
| --------------------- | ------------------------------------------------------------------ |
| `mise run ci`         | Lint, typecheck et tests, comme la CI                              |
| `mise run lint`       | ESLint, Prettier, Knip, et les migrations à jour du schéma         |
| `mise run typecheck`  | TypeScript                                                         |
| `mise run test:unit`  | Vitest : les actions et l'architecture                             |
| `mise run test:e2e`   | Playwright : les parcours du front                                 |
| `mise run web`        | Lance le front en développement, ouvert au réseau local (ADR-0002) |
| `mise run worker`     | Lance le worker sur `data/` : le service lpm `worker`              |
| `mise run db:migrate` | Crée une migration depuis le schéma et l'applique à `dev-data/`    |
| `mise run db:seed`    | Remplace les Offres de `dev-data/` par des Offres factices         |
| `mise run db:reset`   | Recrée la base de `dev-data/` depuis les migrations, puis la seed  |
