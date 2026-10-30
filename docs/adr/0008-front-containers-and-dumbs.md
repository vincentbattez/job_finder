# The front separates Containers, which carry the data, from Dumbs, which only display their props

The components of `src/web/` follow the business Container / Dumb pattern: only a Container reads data or runs an action, and a Dumb only displays what it receives as props. This is what lets the home page and `/postings` share the list, the tiles and the map without duplicating code. In React Router, only a route has a `loader`. A data Container is therefore a file of `src/web/containers/` that exports both its loading function and its component. The page's `loader` calls the loading functions of its Containers and passes them the result. An action Container uses `useFetcher`. Dumbs live in `src/web/components/`. The architecture test forbids them from importing the actions and React Router's data hooks, and a fixture project that breaks the rule proves the test catches it, as for the other architecture rules.

## Considered Options

- **A Container that loads its data itself through `useFetcher` and a resource route, as in the Vue version of the pattern.** Rejected: loading would move to the client, with a loading state and a jumping display, and the front would no longer work before React hydration.
- **No Container level: the page's `loader` shapes the data, and only Dumbs are shared.** Rejected: each page showing the same Postings would redo their shaping.
- **Recognize a Container by its `*-container.tsx` suffix.** Rejected: the folder shows a file's role straight from the tree, and the architecture test rule fits in one glob.
