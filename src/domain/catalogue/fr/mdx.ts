import type { MDX_EN } from '#/domain/catalogue/en/mdx.ts';

export const MDX_FR: typeof MDX_EN = {
  unknownComponent: 'Composant inconnu <{{name}}>',
  notCompiled: 'Une partie de ce texte ne se compile pas en MDX : il est affiché tel qu’il est écrit.',
  tab: 'Onglet {{number}}',
  accordionItem: 'Point {{number}}',
  checklist: 'À faire',
  checklistProgress: '{{checkedCount}} sur {{count}} faits',
  diagramLoading: 'Diagramme en cours de tracé',
  diagramUnreadable: 'Diagramme illisible : {{reason}}',
};
