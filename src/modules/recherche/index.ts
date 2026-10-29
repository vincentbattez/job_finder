import { RECHERCHE_DEFAULT_CONSIGNES } from './consignes.ts';
import { composeRecherchePrompt } from './prompt.ts';

const RECHERCHE_FILE_NAME = 'recherche.md';

// A Recherche starts with its title and ends with its sources, at least one link
function findFormatError(markdown: string): string | undefined {
  if (!markdown.trimStart().startsWith('# ')) {
    return 'il ne commence pas par un titre de niveau 1 (« # »)';
  }
  const sources = markdown.split(/^## Sources[ \t]*$/m, 2)[1] ?? '';
  return /https?:\/\//.test(sources) ? undefined : "il n'a pas de section « ## Sources » avec au moins un lien";
}

// The Recherche of an Offre: a headless Claude session writes a single sourced Markdown file
// (ADR-0003)
export const RECHERCHE_MODULE = {
  fileName: RECHERCHE_FILE_NAME,
  outputFileList: [{ name: RECHERCHE_FILE_NAME, findFormatError }],
  defaultConsignes: RECHERCHE_DEFAULT_CONSIGNES,
  composePrompt: composeRecherchePrompt,
};
