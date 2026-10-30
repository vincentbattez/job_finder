import { JOB_DESCRIPTION_FILE_NAME, type Artefact, type Candidate, type Posting } from '#/domain/index.ts';
import { ARTEFACT_LABEL_BY_ARTEFACT } from '#/domain/labels.ts';
import { BROUILLON_FILE_NAME, LETTRE_MODULE } from '#/modules/lettre/index.ts';

interface IEditedArtefact {
  candidate: Candidate;
  posting: Posting;
  artefact: Artefact;
  // The folder of the Version retenue, relative to the Posting folder
  versionPath: string;
}

// Fixed, with no Instructions to replace it (ADR-0003); the session runs in the Posting folder, its
// « dossier courant »
export function composeEditPrompt({ candidate: { name }, posting, artefact, versionPath }: IEditedArtefact): string {
  // Every Artefact is feminine
  const artefactName = `la ${ARTEFACT_LABEL_BY_ARTEFACT[artefact]}`;
  const lettreFiles =
    artefact === 'lettre'
      ? ` La Lettre à corriger est \`${versionPath}/${LETTRE_MODULE.fileName}\`, et \`${versionPath}/${BROUILLON_FILE_NAME}\` est son Brouillon, ce que l'IA avait écrit.`
      : '';
  return `Tu aides ${name} à modifier ${artefactName} de l'Offre ${posting.reference}, « ${posting.title} ». Parle en français.

Le dossier courant est celui de cette Offre : \`${JOB_DESCRIPTION_FILE_NAME}\` est sa Fiche de poste, et chaque Artefact y a un dossier par Version, numérotées \`v1\`, \`v2\`…

Tu modifies la Version retenue de ${artefactName}, le dossier \`${versionPath}/\` : c'est sur elle que l'outil s'appuie ensuite.${lettreFiles}

Déroulé :
1. Lis les fichiers de \`${versionPath}/\` et la Fiche de poste, puis demande à ${name} ce qu'il faut modifier.
2. Modifie ces fichiers en place : ne crée jamais de nouvelle Version.

Règles non négociables :
- Ne modifie que les fichiers de \`${versionPath}/\` : ni les autres Versions, ni les autres Artefacts, ni la Fiche de poste.
- Ne modifie jamais un Brouillon (\`${BROUILLON_FILE_NAME}\`) : il reste tel que l'IA l'a écrit, pour que l'outil apprenne des corrections de ${name} en le comparant à la Lettre.
- N'invente jamais un fait sur ${name}, l'employeur ou l'Offre. S'il manque une information, demande-la à ${name} ou laisse un repère \`[à compléter : …]\`.
- Garde la structure des fichiers : leurs titres, leurs sections et les liens vers leurs sources.
`;
}
