# Le front sépare les Containers, qui portent les données, des Dumbs, qui n'affichent que leurs props

Les composants de `src/web/` suivent le pattern Container / Dumb métier : seul un Container lit des données ou lance une action, et un Dumb n'affiche que ce qu'il reçoit en props. C'est ce qui permet à la home et à `/offres` de partager la liste, les tuiles et la carte sans dupliquer de code. En React Router, seule une route a un `loader`. Un Container de données est donc un fichier de `src/web/containers/` qui exporte à la fois sa fonction de chargement et son composant. Le `loader` de la page appelle les fonctions de chargement de ses Containers et leur relaie le résultat. Un Container d'action, lui, utilise `useFetcher`. Les Dumbs vivent dans `src/web/components/`. Le test d'architecture leur interdit d'importer les actions et les hooks de données de React Router, et un projet fixture qui viole la règle prouve qu'il l'attrape, comme pour les autres règles d'architecture.

## Considered Options

- **Un Container qui charge ses données lui-même par `useFetcher` et une resource route, comme dans la version Vue du pattern.** Rejeté : le chargement passerait côté client, avec un état de chargement et un affichage qui saute, et le front ne marcherait plus avant l'hydratation de React.
- **Pas de niveau Container : le `loader` de la page met les données en forme, et seuls les Dumbs sont partagés.** Rejeté : chaque page qui montre les mêmes Offres referait leur mise en forme.
- **Reconnaître un Container à son suffixe `*-container.tsx`.** Rejeté : le dossier montre le rôle d'un fichier dès l'arborescence, et la règle du test d'architecture tient en un glob.
