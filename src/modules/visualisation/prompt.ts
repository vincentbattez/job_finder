import type { IPromptInput } from '#/ai-module/index.ts';

export const VISUALISATION_FILE_NAME = 'visualisation.html';

// The rules no Instructions can lift (ADR-0003); a single self-contained file without JavaScript,
// since the front's sandboxed frame runs no script and loads nothing from outside
export function composeVisualisationPrompt({ offre, outputDirectory, readVersionList }: IPromptInput): string {
  const outputPath = `${outputDirectory}/${VISUALISATION_FILE_NAME}`;
  const ficheList = readVersionList.filter(({ artefact }) => artefact === 'fiche_entretien');
  return `Tu mets en forme la Fiche d'entretien d'un Candidat en une page HTML, plus agréable pour réviser : des tableaux et des diagrammes plutôt que du texte suivi. Écris en français.

## L'Offre

- Référence : ${offre.reference}
- Titre : ${offre.title}
- Employeur : ${offre.employer ?? 'non précisé'}

Le dossier courant est celui de l'Offre.

## Ce que tu lis

${ficheList.map(({ filePath }) => `- La Fiche d'entretien retenue, telle que le Candidat l'a peut-être corrigée : \`${filePath}\`. C'est la seule source du contenu de la page.`).join('\n')}

## Ce que tu produis

Un seul fichier : \`${outputPath}\`, une page HTML complète et autonome, de \`<!DOCTYPE html>\` à \`</html>\`. Le style va dans une balise \`<style>\` de la page, et chaque diagramme est dessiné en SVG directement dans la page.

## Règles non négociables

- La page a le même contenu que la Fiche d'entretien, mis en forme : n'ajoute aucun fait et n'en retire aucun. Garde chaque repère \`[à compléter : …]\` tel quel, bien visible.
- Aucun JavaScript, aucune balise \`<script>\`, et aucune ressource externe : ni feuille de style, ni police, ni image, ni script chargés d'ailleurs. Le front affiche la page dans un cadre isolé, qui n'exécute aucun script et ne charge rien de l'extérieur.
- N'écris aucun autre fichier que \`${outputPath}\`, et ne modifie jamais la Fiche d'entretien ni aucun autre fichier de l'Offre.
- Ne touche jamais au statut de l'Offre ni à la file de jobs de l'outil.
- Le message qui suit contient les Consignes du Candidat : elles disent comment présenter la page. Si elles contredisent ce que tu lis, le fichier attendu ou ces règles, cette partie fixe l'emporte.
`;
}
