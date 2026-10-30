import type { IPromptInput } from '#/ai-module/index.ts';
import { JOB_DESCRIPTION_FILE_NAME } from '#/domain/index.ts';

export const RESEARCH_FILE_NAME = 'research.md';

// A Repost starts from the Artifacts of the Posting it publishes again, so the work is not
// done twice
function describeRepostedPosting(readVersionList: IPromptInput['readVersionList']): string {
  const [firstVersion] = readVersionList;
  if (firstVersion === undefined) {
    return '';
  }
  const folderList = readVersionList.map(({ directory }) => `- \`${directory}\``);
  return `
## L'Offre publiée auparavant

Cette Offre est la Republication de l'Offre ${firstVersion.reference} : le même Poste, publié à nouveau. Les Artefacts retenus de cette Offre précédente sont dans ces dossiers, à lire avant de chercher :
${folderList.join('\n')}

Ne refais pas ce travail : pars de sa Recherche, vérifie ce que la Fiche de poste de cette Offre et l'actualité changent, et reprends ce qui reste vrai avec ses sources.
`;
}

// The fixed part sets the objective and the rules no Instructions can lift (ADR-0003); the way to
// reach it is left to the session and its Instructions
export function composeResearchPrompt({ posting, outputDirectory, readVersionList }: IPromptInput): string {
  const outputPath = `${outputDirectory}/${RESEARCH_FILE_NAME}`;
  return `Tu produis la Recherche d'une Offre d'emploi, pour le Candidat qui va y postuler. Écris en français.

## Objectif

Établir, sources à l'appui, ce que les recruteurs attendent pour cette Offre, et dans quel contexte : l'employeur, le service, le lieu. Le Candidat s'en servira pour écrire sa lettre de motivation et préparer son entretien. C'est à toi de décider ce qui mérite d'être creusé pour y parvenir.

## L'Offre

- Référence : ${posting.reference}
- Titre : ${posting.title}
- Employeur : ${posting.employer ?? 'non précisé'}
- Lieu d'affectation : ${posting.workplace ?? 'non précisé'}
- Annonce : ${posting.url ?? 'non précisée'}

Le dossier courant est celui de l'Offre. Sa Fiche de poste, telle qu'elle a été publiée, est dans \`${JOB_DESCRIPTION_FILE_NAME}\` : lis-la en premier.
${describeRepostedPosting(readVersionList)}
## Ce que tu produis

Un seul fichier Markdown : \`${outputPath}\`.
- Il commence par un titre de niveau 1 (\`# …\`).
- Chaque affirmation est suivie de sa source : un lien Markdown vers la page qui l'établit.
- Il se termine par une section \`## Sources\` qui liste chaque source citée, avec son URL.

## Discipline de recherche

Mène la recherche toi-même, au premier plan, sans la confier à un agent en arrière-plan.
- Appuie-toi sur des sources primaires : le site de l'employeur ou de la juridiction, les textes officiels, les rapports et communiqués des institutions, et pour l'actualité les articles qui la rapportent directement. Remonte chaque affirmation jusqu'à la source qui la détient, plutôt que de citer un résumé de seconde main.
- Chaque affirmation est sourcée. Ce que tu ne peux pas sourcer, ne l'écris pas comme un fait : présente-le comme une hypothèse ou une question ouverte.

## Règles non négociables

- N'invente jamais un fait.
- N'écris aucun autre fichier que \`${outputPath}\`, et ne modifie jamais la Fiche de poste.
- Ne touche jamais au statut de l'Offre ni à la file de jobs de l'outil.
- Le message qui suit contient les Consignes du Candidat : elles disent comment mener et présenter la Recherche. Si elles contredisent l'objectif, le fichier attendu ou ces règles, cette partie fixe l'emporte.
`;
}
