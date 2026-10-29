import type { Offre } from '#/domain/index.ts';

// The fixed part of the prompt of the Recherche: its objective, what it reads, what it writes and
// where, and the rules no Consignes can lift (ADR-0003). The objective is fixed, the way to reach
// it is left to the session and its Consignes. It runs in the folder of the Offre.
export function composeRecherchePrompt({ offre, outputDirectory }: { offre: Offre; outputDirectory: string }): string {
  const outputPath = `${outputDirectory}/recherche.md`;
  return `Tu produis la Recherche d'une Offre d'emploi, pour le Candidat qui va y postuler. Écris en français.

## Objectif

Établir, sources à l'appui, ce que les recruteurs attendent pour cette Offre, et dans quel contexte : l'employeur, le service, le lieu. Le Candidat s'en servira pour écrire sa lettre de motivation et préparer son entretien. C'est à toi de décider ce qui mérite d'être creusé pour y parvenir.

## L'Offre

- Référence : ${offre.reference}
- Titre : ${offre.title}
- Employeur : ${offre.employer ?? 'non précisé'}
- Lieu d'affectation : ${offre.workplace ?? 'non précisé'}
- Annonce : ${offre.url ?? 'non précisée'}

Le dossier courant est celui de l'Offre. Sa Fiche de poste, telle qu'elle a été publiée, est dans \`fiche-de-poste.md\` : lis-la en premier.

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
