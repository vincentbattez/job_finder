// The whole prompt of the extraction is fixed: no Candidat can replace it (spec « Modules IA »). It
// runs in the folder of the Offre.
export function composeExtractionPrompt(extractionPath: string): string {
  return `Tu relèves les champs d'une Fiche de poste, une offre d'emploi que le Candidat a trouvée lui-même et importée dans l'outil. Le dossier courant est celui de l'Offre : sa Fiche de poste est dans \`fiche-de-poste.md\`. Lis-la en entier.

## Ce que tu produis

Un seul fichier JSON, \`${extractionPath}\`, de cette forme :

\`\`\`json
{
  "title": "l'intitulé du poste",
  "employer": "l'employeur",
  "workplace": "le lieu d'affectation",
  "city": "la ville du lieu d'affectation",
  "dateLimite": "AAAA-MM-JJ",
  "applicationEmail": "l'adresse où envoyer la candidature",
  "contact1": "le premier contact",
  "contact2": "le second contact"
}
\`\`\`

- Chaque valeur, sauf \`dateLimite\`, est recopiée de la Fiche de poste telle qu'elle y est écrite : un extrait continu du fichier, sans reformuler, corriger ni compléter. Pour \`city\`, le nom de la ville seul, tel qu'il est écrit, par exemple « Lille » dans « 59000 Lille ».
- \`dateLimite\` est le dernier jour pour postuler que donne la Fiche de poste, au format AAAA-MM-JJ.
- \`applicationEmail\` reprend le passage qui donne l'adresse de candidature. \`contact1\` et \`contact2\` reprennent les personnes à contacter, avec leurs coordonnées, dans l'ordre de la Fiche de poste.
- Un champ que la Fiche de poste ne donne pas vaut \`null\`.

## Règles non négociables

- N'invente jamais une valeur, et ne la déduis de rien d'autre que la Fiche de poste : dans le doute, \`null\`.
- N'écris aucun autre fichier que \`${extractionPath}\`, et ne modifie jamais la Fiche de poste.
- Ne cherche rien sur le web : tout est dans la Fiche de poste.
- Ne touche jamais au statut de l'Offre ni à la file de jobs de l'outil.
`;
}

// The message of the session: the fixed prompt above says everything
export const EXTRACTION_REQUEST = 'Relève les champs de la Fiche de poste.';
