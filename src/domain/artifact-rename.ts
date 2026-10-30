import type { Artifact } from './index.ts';

// Each Artifact as the French jf named it, in the folders of the data and in the routes of the front,
// and its English name: one table for the layout migration and the redirects (#65)
export const ARTIFACT_RENAME_LIST: { from: string; to: Artifact }[] = [
  { from: 'recherche', to: 'research' },
  { from: 'lettre', to: 'letter' },
  { from: 'fiche_entretien', to: 'interview_brief' },
  { from: 'visualisation', to: 'visualization' },
];
