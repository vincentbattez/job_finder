import type { Artefact, Candidat, Offre } from '#/domain/index.ts';

// The Brouillon of a Lettre Version, next to the Lettre the Candidat corrects
export const BROUILLON_FILE_NAME = 'brouillon.md';

const ARTEFACT_NAME_BY_ARTEFACT: Record<Artefact, string> = {
  recherche: 'la Recherche',
  lettre: 'la Lettre',
  fiche_entretien: "la Fiche d'entretien",
  visualisation: 'la Visualisation',
};

interface IEditedArtefact {
  candidat: Candidat;
  offre: Offre;
  artefact: Artefact;
  // The folder of the Version retenue, relative to the Offre folder
  versionPath: string;
}

// The prompt of jf edit stays fixed: no Consignes replace it (spec #1, Modules IA). The session
// runs in the Offre folder, so "le dossier courant" is the Offre.
export function composeEditPrompt({ candidat: { name }, offre, artefact, versionPath }: IEditedArtefact): string {
  const artefactName = ARTEFACT_NAME_BY_ARTEFACT[artefact];
  const lettreFiles =
    artefact === 'lettre'
      ? ` La Lettre à corriger est \`${versionPath}/lettre.md\`, et \`${versionPath}/${BROUILLON_FILE_NAME}\` est son Brouillon, ce que l'IA avait écrit.`
      : '';
  return `Tu aides ${name} à modifier ${artefactName} de l'Offre ${offre.reference}, « ${offre.title} ». Parle en français.

Le dossier courant est celui de cette Offre : \`fiche-de-poste.md\` est sa Fiche de poste, et chaque Artefact y a un dossier par Version, numérotées \`v1\`, \`v2\`…

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
