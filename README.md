# job_finder

Veille d'offres d'emploi et préparation des candidatures. Vocabulaire : `GLOSSARY.md`. Décisions : `docs/adr/`. Règles de code : `CODING_STANDARDS.md`.

## Installation

```bash
mise install                                   # Node 26, lefthook, gitleaks, puis npm install (et prisma generate) et les git hooks
mise run init                                  # crée data/config.json depuis l'exemple, à adapter ensuite, et remplit dev-data/
cp .env.example .env                           # puis y renseigner l'URL et le token de Home Assistant, pour les notifications
jf                                             # affiche l'aide
jf detect                                      # cherche les nouvelles Offres de chaque Veille
jf import offre.md lea                         # importe une Fiche de poste en Markdown trouvée ailleurs : le worker en relève les champs avec Claude, puis met sa Recherche en file ; --wait attend l'extraction
jf run extraction import-1a2b3c4d5e            # relance l'extraction des champs d'une Offre importée, après un échec
jf list lea                                    # liste les Offres d'un Candidat, avec leur statut et celles qui sont Expirées
jf postuler 2026-2445600                       # passe une Offre en Postulée, ce qui fige sa Lettre ; jf archiver l'archive
jf run recherche 2026-2445600                  # met en file une nouvelle Version de la Recherche d'une Offre ; --wait attend que le worker l'ait produite
jf run lettre 2026-2445600                     # met en file une nouvelle Version de la Lettre, sur la Recherche retenue
jf run fiche 2026-2445600                      # met en file une nouvelle Version de la Fiche d'entretien, sur la Recherche retenue, et la Lettre retenue s'il y en a une
jf destinataires 2026-2445600                  # affiche à qui adresser la candidature, selon la Lettre retenue
jf versions 2026-2445600 recherche             # liste les Versions d'un Artefact, chacune avec l'origine de ses Consignes : par défaut ou du Candidat
jf retenir 2026-2445600 recherche 1            # change la Version retenue
jf edit 2026-2445600 recherche                 # corrige la Version retenue d'un Artefact avec Claude Code ; sans argument, propose les Offres puis l'Artefact
jf consignes lea                               # dit, pour chaque module, si le Candidat suit les Consignes par défaut ou les siennes
jf consignes lea lettre                        # affiche les Consignes que suit la Lettre ; « defaut » affiche celles par défaut
jf consignes lea lettre remplacer < c.md       # remplace les Consignes de la Lettre par celles du fichier ; « supprimer » revient à celles par défaut
```

`jf` est sur le `PATH` dès que mise est actif dans le dossier du repo.

## Front

Le front, service lpm `web` déclaré dans `.lpm.yml` (`mise run web`), sert les Offres de `data/` sur le port 5180, sans authentification : il n'est joignable qu'en LAN et via WireGuard, jamais depuis internet (ADR-0002). On l'ouvre par l'adresse IP du Mac mini ou par son nom `.local`, par exemple `http://mac-mini-vincent.local:5180`. Le Candidat se choisit dans le menu du haut, mémorisé par un cookie ; la fiche de chaque Offre montre ses contacts bruts, les destinataires recommandés par la Lettre retenue, la Fiche de poste et toutes les Versions de chaque Artefact, avec la commande `jf edit` à copier et les Consignes qui ont produit chaque Version. La page Profil modifie les fichiers du Profil du Candidat ; la page Consignes montre les Consignes par défaut de chaque module, et y crée, modifie ou supprime celles du Candidat. La partie fixe des prompts n'y apparaît pas : elle reste dans le code.

Sur la fiche, chaque Artefact montre son état (absent, en cours, prêt, en échec) et le bouton de son module : il met le job en file, comme `jf run`, et le worker l'exécute. Le bouton attend tant qu'il manque au module une entrée, par exemple une Recherche retenue pour la Lettre, et dit laquelle. L'état se met à jour tout seul jusqu'à ce que le job soit fini. La liste des Offres a un bouton « Lancer une Détection », la même action que `jf detect`, qui dit ce qu'elle a trouvé pour chaque Veille. Une Fiche de poste en Markdown glissée sur la liste, ou choisie avec « Importer une Fiche de poste », devient aussitôt une Offre, au nom de son fichier, comme avec `jf import` ; sa fiche suit l'extraction de ses champs par le worker, et la relance après un échec. Comme le worker, le front lit `.env` pour les notifications.

`JF_DATA_DIRECTORY` sert le front sur un autre dossier : `JF_DATA_DIRECTORY=dev-data mise run web` pour les Offres factices.

## Worker

Lancer un module ne fait que mettre son job en file. Le worker, service lpm `worker` déclaré dans `.lpm.yml` (`mise run worker`), exécute les jobs de `data/` un par un, donc une seule session Claude à la fois, dans son propre processus : redémarrer le front ne coupe pas une session (ADR-0003). Un job interrompu par un arrêt du worker passe « en échec » à son redémarrage, et se relance avec `jf run`. Une nouvelle Offre détectée dans la Zone met sa Recherche en file, sauf au premier lancement.

## Détection quotidienne

L'automation lpm `detect`, déclarée dans `.lpm.yml`, lance `jf detect` chaque jour à 18:00 (ADR-0003). Son run affiche « aucune nouvelle Offre » ou la liste des nouvelles Offres. Une Détection en échec sort en erreur : lpm marque le run « needs a look » et notifie. `.lpm.yml` se vérifie avec `lpm config validate .lpm.yml`.

## Notifications

Le Candidat est notifié sur son téléphone :

- d'une nouvelle Offre dans sa Zone, avec son titre, sa juridiction et sa Date limite. Rien n'est envoyé au premier lancement, ni quand la Détection ne trouve rien ;
- d'une Recherche prête, quand le worker l'a produite.

Le seul canal est Home Assistant. La cible de chaque Candidat est le service `notify.mobile_app_*` de son téléphone, dans `data/config.json`. L'URL de Home Assistant et un token longue durée (profil Home Assistant, onglet Sécurité) vont dans `.env`, hors de git, sur le modèle de `.env.example`. `jf` et le worker le lisent au lancement. Une notification qui ne part pas n'empêche rien : la Détection enregistre d'abord toutes les nouvelles Offres et met leur Recherche en file, puis échoue avec un message qui dit quoi vérifier. Le worker, lui, ne s'arrête pas : il écrit l'échec dans son log (`lpm logs worker`) et continue la file.

## Données

Tout vit dans `data/`, hors de git et sans sauvegarde :

- `config.json` : les Candidats, leurs Veilles et leur cible de notification, et le délai par défaut. Le modèle versionné est `config.example.json` ;
- `job_finder.sqlite` : la base, migrée à chaque lancement ;
- `candidats/<id>/profil/` : le Profil de chaque Candidat, en fichiers Markdown : `faits.md`, `cv.md` et une `lettre-<employeur>-<année>.md` par lettre passée. `jf profil <candidat>` les écrit et les complète au fil d'une session Claude Code interactive ;
- `candidats/<id>/offres/<référence>-<titre>/` : un dossier par Offre, avec sa Fiche de poste (`fiche-de-poste.md`) sauvegardée dès la Détection, et un dossier par Version de chaque Artefact, par exemple `recherche/v2/recherche.md`. Une Version de la Lettre (`lettre/v<n>/`) contient le Brouillon (`brouillon.md`, en lecture seule), la Lettre à corriger (`lettre.md`, d'abord sa copie) et les destinataires recommandés (`destinataires.json`). Une Version de la Fiche d'entretien (`fiche_entretien/v<n>/fiche-entretien.md`) a toujours les sections « À réviser », « Moyens mnémotechniques », « Présentez-vous » et « Questions probables » ;
- `candidats/<id>/consignes/<artefact>.md` : les Consignes d'un module que le Candidat a remplacées, par exemple `recherche.md`. Sans ce fichier, le module suit ses Consignes par défaut.

`dev-data/` a la même forme, avec des Offres factices pour le développement. Les commandes Prisma et les tasks `db:` ne touchent qu'à lui.

## Base de données

Le schéma est décrit dans `prisma/schema.prisma`, seule source à éditer. Après une modification, `mise run db:migrate` génère la migration dans `prisma/migrations/` et l'applique à `dev-data/`. Une migration générée ne s'édite pas à la main. `jf` applique les migrations en attente à `data/` à chaque lancement.

## Code

- `src/actions/` : la couche d'actions, seule source de vérité de chaque fonctionnalité. La CLI et le front ne font que l'appeler (ADR-0003). Les tests passent par elle.
- `src/cli/` : la CLI `jf`, qui relaie vers les actions.
- `src/worker/` : le worker, qui relaie lui aussi vers les actions : il vide la file de jobs. Seul lui exécute les jobs, ce que vérifie `test/architecture.test.ts`.
- `src/web/` : le front React Router, qui relaie lui aussi vers les actions, ouvertes une fois pour tout le serveur dans `acl/actions.server.ts`. `/design` montre ses composants avec des Offres d'exemple. Les couleurs, les polices et les espacements sont des tokens de `src/web/tokens.css`.
- `src/domain/` : les types domaine, tirés de leurs schémas Zod. Une fois passée l'anti-corruption layer, le code ne manipule qu'eux (ADR-0005).
- `src/workspace/` : l'accès au dossier de données (config, base, dossiers des Candidats). Seul son dossier `acl/` lit la config et la base. Le client Prisma est généré dans `generated/`, hors de git.
- `src/ai-session/` : le lancement des sessions d'IA. Seul `acl/claude-code.ts` sait qu'elles tournent sur Claude Code, toujours sur l'abonnement (`claude -p`, sans clé API) ; les tests le remplacent par un faux.
- `src/actions/run-job.ts` : l'exécution d'un job d'un module IA : la Version, le prompt en deux parties (partie fixe et Consignes), la vérification du fichier produit et la Version retenue.
- `src/profil/` : le prompt fixe de `jf profil`.
- `src/edit/` : le prompt fixe de `jf edit`, qui ouvre une session dans le dossier de l'Offre, sans shell ni web, où aucun Brouillon ne peut être modifié.
- `src/statut/` : les règles du statut d'une Offre : le calcul d'Expirée, et le gel de la Lettre retenue d'une Offre Postulée.
- `src/modules/` : un dossier par module, avec un seul point d'entrée. Un module n'en importe jamais un autre, ce que vérifie `test/architecture.test.ts`. Un module IA, comme `recherche/`, a sa partie fixe du prompt dans `prompt.ts` et ses Consignes par défaut dans `consignes.ts`.
- `src/modules/source-import/` : la Source Import Markdown. L'import enregistre l'Offre et met en file l'extraction de ses champs ; le worker la lance comme un module, dans une session Claude sans interface au prompt fixe, qui écrit `extraction/extraction.json` dans le dossier de l'Offre. `acl/extraction.ts` refuse toute valeur que la Fiche de poste ne contient pas telle quelle. Les champs remplissent l'Offre, dont le dossier suit le nouveau titre, puis sa Recherche est mise en file. La référence de l'Offre vient du contenu du fichier : importer deux fois le même fichier redonne la même Offre, sans nouveau job.
- `src/modules/notification/` : le texte de chaque notification, et l'interface commune aux canaux. Seul `acl/home-assistant.ts` sait appeler Home Assistant.
- `prisma/` : le schéma, les migrations et le seed.
- `test/fixtures/pep/` : les réponses du site PEP enregistrées le 2026-10-29, que `test/recorded-http.ts` sert aux tests à la place du vrai site.
- `test/fake-notification-channel.ts` : le faux canal de notification, qui garde les notifications au lieu de les envoyer. Les tests ne lisent jamais `.env`, et `vitest.config.ts` comme `playwright.config.ts` vident les réglages de Home Assistant : un test qui oublie le faux canal n'envoie jamais de vraie notification.
- `test/fake-ai-session.ts` : le faux lancement de Claude, qui écrit l'Artefact prévu et garde le prompt reçu. `test/fixtures/claude/claude` remplace le binaire `claude` pour tester le vrai lancement sans ouvrir de session.
- `test/seed-front.ts` : les données des tests Playwright, produites par les actions avec les faux dans un dossier temporaire, jamais `data/`. `playwright.config.ts` le lance avant le serveur de développement, qu'il pointe sur ce dossier.
- `test/e2e-actions.server.ts` : les actions des tests Playwright, avec les trois faux. Le serveur de développement les sert à la place de `src/web/acl/actions.server.ts` en mode `e2e` (`vite.config.ts`), et `test/e2e-worker.ts`, le worker des tests, exécute avec elles les jobs mis en file par le front.

## Commandes

| Commande              | Rôle                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `mise run ci`         | Lint, typecheck et tests, comme la CI                             |
| `mise run lint`       | ESLint, Prettier, Knip, et les migrations à jour du schéma        |
| `mise run typecheck`  | TypeScript                                                        |
| `mise run test:unit`  | Vitest : les actions et l'architecture                            |
| `mise run test:e2e`   | Playwright : les parcours du front                                |
| `mise run web`        | Sert le front de `data/` sur le port 5180 : le service lpm `web`  |
| `mise run worker`     | Lance le worker sur `data/` : le service lpm `worker`             |
| `mise run db:migrate` | Crée une migration depuis le schéma et l'applique à `dev-data/`   |
| `mise run db:seed`    | Remplace les Offres de `dev-data/` par des Offres factices        |
| `mise run db:reset`   | Recrée la base de `dev-data/` depuis les migrations, puis la seed |
