# Coding standards

Les règles génériques du code. Le pourquoi d'une décision est dans son ADR (`docs/adr/`), le vocabulaire dans `GLOSSARY.md`. Une règle marquée **(CI)** ou **(hook)** est vérifiée automatiquement, par la CI ou par un hook git. Les autres se vérifient en revue. Tout écart se justifie dans la PR.

## Principes

- **Le moins de code qui atteint le résultat.** On écrit ce que le ticket demande. Une famille de modules interchangeables (Sources, Canaux de notification) garde un seul module tant qu'un deuxième n'est pas demandé, mais son contrat est générique dès le premier (ADR-0010).
- **Une règle qui compte est vérifiée par la machine** : un test, le typecheck ou le lint. Une règle seulement écrite finit contournée par oubli.
- **Idempotence.** Relancer une commande, une Détection ou un job donne le même résultat, sans doublon.
- **Échec visible.** Une erreur arrête la commande avec un code de sortie non nul et un message en français qui dit quoi faire. Un silence veut toujours dire « rien à signaler ».

## Architecture

- **Actions.** Chaque fonctionnalité est une action de `src/actions/`. La CLI et le front relaient vers elle, sans règle métier (ADR-0003). **(CI)**
- **Modules.** Un module vit dans son dossier de `src/modules/`, avec un seul point d'entrée et ses prompts dans des fichiers à part. Il échange avec les autres modules par les Artefacts sur disque et par la base, sans les importer (ADR-0003). **(CI)**
- **Modules interchangeables (ADR-0010).** Quand le Candidat choisit entre plusieurs modules qui font le même travail (un Canal de notification, la Source d'une Veille), ces modules forment une famille :
  - le contrat de la famille vit dans `src/<famille>/` ;
  - chaque module vit dans `src/modules/<famille>-<nom>/` et exporte un descripteur : identifiant, nom affiché, Paramètres décrits par un schéma Zod (obligatoires, optionnels, secrets), opérations ;
  - la base garde une table par famille, avec l'identifiant du module choisi et ses Paramètres en Json ; le domaine, les actions et le front ne manipulent que la famille, et le formulaire se construit à partir du descripteur ;
  - le nom d'un module n'apparaît que dans son dossier et dans le registre `src/actions/modules.ts`. Ajouter un module, c'est un dossier et une ligne de registre, sans migration ni écran. **(CI)**
- Les imports forment un graphe sans cycle. **(CI)**
- Toute l'application vit dans `src/`.

## Anti-corruption layer (ADR-0005)

- **Domaine.** Chaque concept du domaine a son schéma Zod dans `src/domain/`, terminé par `.brand<'Domain'>()`. Son type en est tiré par `z.infer`. Une énumération (`z.enum`) reste sans brand, pour que ses littéraux s'écrivent dans le code : l'objet qui la porte a le sien. Un schéma qui porte un secret, comme un Paramètre secret d'un Canal de notification, a le brand `'Secret'` : le typecheck refuse alors qu'une action le renvoie (ADR-0006).
- **ACL.** La donnée brute (base, fichiers, HTTP, sous-processus, environnement) se lit dans un dossier `acl/`. Il la parse avec un schéma du domaine et n'exporte que des types domaine. **(CI)**
- Une action reçoit son entrée en `unknown` et la parse. Elle renvoie `void` ou des valeurs du domaine. **(CI)**
- Une valeur du domaine s'obtient toujours par `parse`. Les assertions `as` sont refusées. **(CI)**
- La validation se fait aux frontières. Une fois passée l'ACL, le code se fie aux types.
- Un nouvel accès brut, par exemple un client HTTP ou un SDK, s'ajoute à `RAW_DATA_ACCESS_LIST` dans `test/architecture.test.ts`.

## Code

- Node exécute le TypeScript sans build, donc seule la syntaxe effaçable est permise. Une énumération s'écrit en union de littéraux ou en `z.enum`. **(CI)**
- Un import passe par l'alias `#/` ou reste dans le dossier courant (`./`), avec son extension `.ts`. **(CI)**
- Les exports sont nommés. Seules les configs d'outils et les modules de route de React Router, qui l'exigent, exportent par défaut. **(CI)**
- Pour le nommage, `eslint.config.ts` fait foi : un tableau finit en `List`, un booléen commence par `is` ou `has`, une interface par `I`, et les constantes de module sont en `UPPER_CASE`. **(CI)**
- Les identifiants et les messages reprennent les termes de `GLOSSARY.md`, en français : `Candidat`, `listCandidats`, `veilleList`.
- Le code, les commentaires et les commits sont en anglais. Les messages à l'utilisateur, le README, les ADR et le glossaire sont en français.
- Un commentaire donne, en une ou deux lignes, le pourquoi qu'on ne lit pas dans le code, et cite l'ADR concerné.

## Données

- `data/` contient les vraies données des Candidats, et seul `jf` y écrit. Le développement, les tests et le seed travaillent dans `dev-data/` ou dans un dossier temporaire.
- `prisma/schema.prisma` est la seule source du schéma. Une migration est générée par `mise run db:migrate`, puis gardée telle quelle. **(CI)**

## Tests

- Un test passe par les actions et vérifie ce qui s'observe : les Offres en base, les Artefacts sur disque, les jobs en file, les notifications envoyées.
- Seule une règle qui a beaucoup de cas a aussi des tests unitaires, à côté de son code : le statut (`src/statut/`), la Republication (`src/republication/`), le titre d'une Veille (`src/modules/source-pep/title.ts`), la ville d’un lieu d’affectation (`src/geo/city.ts`) et les rubriques des Faits dans `faits.md` (`src/profil/faits.ts`).
- Seules les frontières externes sont simulées : le HTTP des Sources (avec des réponses enregistrées), le lancement de Claude et le Canal de notification. Un faux module de la famille (`test/fake-canal-notification.ts`) remplace le registre quand un test ne regarde que les notifications envoyées. Un module qui appelle un service par HTTP est testé contre un faux serveur qui répond comme lui, par exemple `test/fake-home-assistant.ts` : ses tests et les e2e passent par ce serveur plutôt que par un `fetch` remplacé.
- Chaque Canal de notification donne à `test/write-only-token.test.ts` des Paramètres que son faux serveur accepte : le test vérifie qu'aucune action ne renvoie l'un de ses Paramètres secrets, et échoue tant qu'un Canal n'y figure pas. Aucune Source n'a encore de Paramètre secret : la première qui en déclare un y entre aussi.
- Un test e2e qui change des données change les siennes, que lui seul touche (son Offre, son Candidat), et les remet en place au début, pas à la fin : il passe seul, répété (`--repeat-each` avec `--workers=1`) ou à côté des autres. `fullyParallel` fait échouer celui qui lit ce qu'un autre a laissé. **(CI)**
- Chaque règle d'architecture a un projet fixture qui la viole, pour prouver qu'elle attrape bien quelque chose.

## Git

- Les commits suivent Conventional Commits, avec un scope obligatoire et un sujet en sentence case. **(hook)**
- Chaque ticket a sa branche et sa PR. La PR ferme le ticket et passe la CI.
