import type { IPromptInput } from '#/ai-module/index.ts';
import { JOB_DESCRIPTION_FILE_NAME } from '#/domain/index.ts';

export const INTERVIEW_BRIEF_FILE_NAME = 'interview-brief.md';

// The Chosen Letter when there is one: the recruiters question the Candidate on what it says
function describeLetter(readVersionList: IPromptInput['readVersionList']): string {
  const letter = readVersionList.find(({ artifact }) => artifact === 'letter');
  return letter === undefined
    ? "Le Candidat n'a pas de Lettre pour cette Offre : prépare l'entretien sans elle."
    : `La Lettre retenue, celle que le Candidat a envoyée ou va envoyer : \`${letter.filePath}\`. Les recruteurs l'auront lue : prépare les questions qu'ils poseront sur ce qu'il y a écrit.`;
}

// The fixed part: its objective, inputs and output, and the rules no Instructions can lift (ADR-0003)
export function composeInterviewBriefPrompt({
  posting,
  outputDirectory,
  readVersionList,
  profileDirectory,
}: IPromptInput): string {
  const outputPath = `${outputDirectory}/${INTERVIEW_BRIEF_FILE_NAME}`;
  const researchList = readVersionList.filter(({ artifact }) => artifact === 'research');
  return `Tu écris la Fiche d'entretien d'un Candidat pour une Offre d'emploi : ce qu'il doit réviser et comment s'entraîner avant l'entretien de recrutement. Écris en français.

## L'Offre

- Référence : ${posting.reference}
- Titre : ${posting.title}
- Employeur : ${posting.employer ?? 'non précisé'}
- Lieu d'affectation : ${posting.workplace ?? 'non précisé'}

Le dossier courant est celui de l'Offre.

## Ce que tu lis

Lis tout avant d'écrire :
- La Fiche de poste, telle qu'elle a été publiée : \`${JOB_DESCRIPTION_FILE_NAME}\`.
${researchList.map(({ filePath }) => `- La Recherche retenue, qui établit ce que les recruteurs attendent et dans quel contexte : \`${filePath}\`.`).join('\n')}
- Le Profil du Candidat, dans \`${profileDirectory}\` : les faits qu'il a validés, son CV et ses lettres passées, quand ils existent. Lis chacun de ses fichiers : c'est la seule source des faits sur le Candidat.
- ${describeLetter(readVersionList)}

## Ce que tu produis

Un seul fichier Markdown : \`${outputPath}\`, qui commence par un titre de niveau 1 (\`# …\`). Les Consignes du Candidat disent comment l'organiser.

## Règles non négociables

- N'invente jamais un fait sur le Candidat : diplômes, dates, stages, expériences, compétences, motivations, mobilité. Chaque fait vient de son Profil ou de sa Lettre. Ne déduis rien qui n'y est pas écrit.
- Partout où la Fiche d'entretien a besoin d'un fait que tu n'as pas, écris à sa place un repère \`[à compléter : …]\` qui dit précisément ce qui manque, par exemple \`[à compléter : sujet du mémoire de master]\`.
- N'invente aucun fait sur l'Offre ni sur l'employeur : appuie-toi sur la Fiche de poste et la Recherche retenue.
- N'écris aucun autre fichier que \`${outputPath}\`, et ne modifie jamais la Fiche de poste, la Recherche, le Profil ni la Lettre.
- Ne touche jamais au statut de l'Offre ni à la file de jobs de l'outil.
- Le message qui suit contient les Consignes du Candidat : elles disent comment préparer, organiser et présenter la Fiche d'entretien. Si elles contredisent ce que tu lis, le fichier attendu ou ces règles, cette partie fixe l'emporte.
`;
}
