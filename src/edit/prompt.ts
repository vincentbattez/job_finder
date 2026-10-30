import { catalogueOf } from '#/domain/catalogue/index.ts';
import { JOB_DESCRIPTION_FILE_NAME, type Artifact, type Candidate, type Posting } from '#/domain/index.ts';
import { DRAFT_FILE_NAME, LETTER_MODULE } from '#/modules/letter/index.ts';

interface IEditedArtifact {
  candidate: Candidate;
  posting: Posting;
  artifact: Artifact;
  // The folder of the Chosen Version, relative to the Posting folder
  versionPath: string;
}

// Fixed, with no Instructions to replace it (ADR-0003); the session runs in the Posting folder, its
// « dossier courant »
export function composeEditPrompt({ candidate: { name }, posting, artifact, versionPath }: IEditedArtifact): string {
  // Every Artifact is feminine; the prompt is French until #75 rewrites it
  const artifactName = `la ${catalogueOf(null).common.artifactLabelByArtifact[artifact]}`;
  const letterFiles =
    artifact === 'letter'
      ? ` La Lettre à corriger est \`${versionPath}/${LETTER_MODULE.fileName}\`, et \`${versionPath}/${DRAFT_FILE_NAME}\` est son Brouillon, ce que l'IA avait écrit.`
      : '';
  return `Tu aides ${name} à modifier ${artifactName} de l'Offre ${posting.reference}, « ${posting.title} ». Parle en français.

Le dossier courant est celui de cette Offre : \`${JOB_DESCRIPTION_FILE_NAME}\` est sa Fiche de poste, et chaque Artefact y a un dossier par Version, numérotées \`v1\`, \`v2\`…

Tu modifies la Version retenue de ${artifactName}, le dossier \`${versionPath}/\` : c'est sur elle que l'outil s'appuie ensuite.${letterFiles}

Déroulé :
1. Lis les fichiers de \`${versionPath}/\` et la Fiche de poste, puis demande à ${name} ce qu'il faut modifier.
2. Modifie ces fichiers en place : ne crée jamais de nouvelle Version.

Règles non négociables :
- Ne modifie que les fichiers de \`${versionPath}/\` : ni les autres Versions, ni les autres Artefacts, ni la Fiche de poste.
- Ne modifie jamais un Brouillon (\`${DRAFT_FILE_NAME}\`) : il reste tel que l'IA l'a écrit, pour que l'outil apprenne des corrections de ${name} en le comparant à la Lettre.
- N'invente jamais un fait sur ${name}, l'employeur ou l'Offre. S'il manque une information, demande-la à ${name} ou laisse un repère \`[à compléter : …]\`.
- Garde la structure des fichiers : leurs titres, leurs sections et les liens vers leurs sources.
`;
}
