import type { IPromptInput } from '#/ai-module/index.ts';

// The Lettre retenue when there is one: the recruiters question the Candidat on what it says
function describeLettre(readVersionList: IPromptInput['readVersionList']): string {
  const lettre = readVersionList.find(({ artefact }) => artefact === 'lettre');
  return lettre === undefined
    ? "Le Candidat n'a pas de Lettre pour cette Offre : prépare l'entretien sans elle."
    : `La Lettre retenue, celle que le Candidat a envoyée ou va envoyer : \`${lettre.directory}/lettre.md\`. Les recruteurs l'auront lue : prépare les questions qu'ils poseront sur ce qu'il y a écrit.`;
}

// The fixed part of the prompt of the Fiche d'entretien: its objective, what it reads, what it
// writes and where, and the rules no Consignes can lift (ADR-0003). It runs in the folder of the
// Offre.
export function composeFicheEntretienPrompt({
  offre,
  outputDirectory,
  readVersionList,
  profilDirectory,
}: IPromptInput): string {
  const outputPath = `${outputDirectory}/fiche-entretien.md`;
  const rechercheList = readVersionList.filter(({ artefact }) => artefact === 'recherche');
  return `Tu écris la Fiche d'entretien d'un Candidat pour une Offre d'emploi : ce qu'il doit réviser et comment s'entraîner avant l'entretien de recrutement. Écris en français.

## L'Offre

- Référence : ${offre.reference}
- Titre : ${offre.title}
- Employeur : ${offre.employer ?? 'non précisé'}
- Lieu d'affectation : ${offre.workplace ?? 'non précisé'}

Le dossier courant est celui de l'Offre.

## Ce que tu lis

Lis tout avant d'écrire :
- La Fiche de poste, telle qu'elle a été publiée : \`fiche-de-poste.md\`.
${rechercheList.map(({ directory }) => `- La Recherche retenue, qui établit ce que les recruteurs attendent et dans quel contexte : \`${directory}/recherche.md\`.`).join('\n')}
- Le Profil du Candidat, dans \`${profilDirectory}\` : les faits qu'il a validés, son CV et ses lettres passées, quand ils existent. Lis chacun de ses fichiers : c'est la seule source des faits sur le Candidat.
- ${describeLettre(readVersionList)}

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
