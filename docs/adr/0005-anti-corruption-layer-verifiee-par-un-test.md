# Une anti-corruption layer à chaque frontière, vérifiée par un test

Toute donnée venue de l'extérieur est validée par Zod et convertie en type domaine avant d'entrer dans l'application : la base, un fichier, une API, un sous-processus, l'environnement, ce qu'un utilisateur saisit dans le front ou la CLI. Les types domaine sont dans `src/domain/`, tirés de leurs schémas Zod. Chaque schéma porte le brand `'Domain'`, qu'une valeur n'obtient qu'en passant par `parse`. Seuls les dossiers `acl/` touchent la donnée brute : le client Prisma, `fetch`, la lecture de fichiers, `JSON.parse`, `node:child_process` et `process.env`. Les actions sont la frontière avec le front et la CLI. Chacune reçoit son entrée en `unknown` et la parse elle-même. Elle ne renvoie rien, ou des valeurs du domaine.

Trois contrôles le garantissent en CI :

- `test/architecture.test.ts` échoue dès qu'un fichier de `src/` hors d'un dossier `acl/` utilise l'un de ces accès ;
- le typecheck refuse une action dont l'entrée n'est pas `unknown`, ou dont la sortie n'est ni `void` ni une valeur brandée (`satisfies` dans `src/actions/index.ts`) ;
- ESLint interdit les assertions de type (`as`), pour qu'on ne puisse pas fabriquer le brand à la main.

## Considered Options

- **Des types domaine sans brand.** Rejeté : une ligne Prisma a la même forme qu'un type domaine, et TypeScript l'accepte. On l'a vérifié en ajoutant un modèle `Pays` : une méthode de `src/workspace/acl/database.ts` qui renvoyait la ligne brute, relayée par une action, passait le test et le typecheck.
- **Convertir les lignes de la base sans les valider**, comme le suggère le wiki pour un repository. Rejeté : SQLite ne vérifie ni les enums ni les colonnes Json, comme les critères et la Zone d'une Veille (ADR-0004). Un parse Zod à chaque lecture coûte peu.
- **Un seul dossier `src/acl/` pour toute l'application.** Rejeté : chaque Source est un module indépendant (ADR-0003). Son ACL vit donc dans son propre dossier, par exemple `src/modules/<source>/acl/`.
- **Des règles ESLint** (`no-restricted-imports`, `no-restricted-globals`, `no-restricted-properties`) **à la place du test.** Elles sont plus précises, car elles lisent l'AST, mais les frontières restent vérifiées au même endroit, dans le test d'architecture.
- **Une règle `adhereTo` d'archunit.** Elle lit chaque fichier par rapport au dossier courant. Sur un projet fixture, elle voit donc des fichiers vides et ne prouve rien (vérifié). Le test lit les fichiers lui-même.

## Consequences

- Toute l'application vit dans `src/`, puisque le test ne regarde que là. Le front devra s'y trouver aussi : il n'ira pas dans le `app/` par défaut de React Router.
- Les tests, le seed et les configs d'outils manipulent la donnée brute exprès. Le seed écrit ses Offres factices avec son propre client Prisma.
- Une donnée qui ne sort pas par une action n'est pas contrôlée, par exemple celle qu'un module écrit en base. Un dossier `acl/` peut encore la transmettre sans l'avoir parsée, mais elle n'atteint ni le front ni la CLI.
- Le test reconnaît un accès à son texte. Il vise l'oubli, pas la triche : un alias comme `globalThis['fe' + 'tch']` passerait. Un nouvel accès brut, par exemple un client HTTP autre que `fetch`, s'ajoute à sa liste.
- Une action qui renvoie un objet composé, comme une Offre avec ses Versions, le décrit par son propre schéma du domaine.
- Le front, comme la CLI, n'atteint les fonctionnalités que par les actions. Le ticket qui crée le front ajoute la règle archunit qui le vérifie.
