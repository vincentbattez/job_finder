import { RECHERCHE_DEFAULT_CONSIGNES } from './consignes.ts';
import { composeRecherchePrompt } from './prompt.ts';

// The Recherche of an Offre: a headless Claude session writes a single sourced Markdown file
// (ADR-0003)
export const RECHERCHE_MODULE = {
  outputFileName: 'recherche.md',
  defaultConsignes: RECHERCHE_DEFAULT_CONSIGNES,
  composePrompt: composeRecherchePrompt,

  // A Recherche starts with its title and ends with its sources, at least one link
  findFormatError(markdown: string): string | undefined {
    if (!markdown.trimStart().startsWith('# ')) {
      return 'il ne commence pas par un titre de niveau 1 (« # »)';
    }
    const sources = markdown.split(/^## Sources[ \t]*$/m, 2)[1] ?? '';
    return /https?:\/\//.test(sources) ? undefined : "il n'a pas de section « ## Sources » avec au moins un lien";
  },
};
