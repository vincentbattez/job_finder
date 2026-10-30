import type { Candidate } from '#/domain/index.ts';
import { CONVERSION_INSTRUCTIONS } from '#/profile/prompt.ts';

// The whole prompt is fixed, with no Instructions: the conversion only copies (ADR-0003). Its rules are
// those of jf profile, which converts the same documents with the Candidate.
export function composeConversionPrompt({ name }: Candidate, uploadPath: string, outputDirectory: string): string {
  return `Tu convertis en Markdown une Pièce que ${name} a déposée dans son Profil de Candidat : un document d'origine, son CV ou une lettre de motivation passée, en PDF. Le dossier courant est ce Profil : la Pièce est \`${uploadPath}\`. Lis-la en entier.

## Ce que tu produis

La Pièce est un seul document : ${CONVERSION_INSTRUCTIONS}.

Écris ce seul fichier dans le dossier \`${outputDirectory}\`, jamais ailleurs : l'outil le range ensuite dans le Profil.

## Règles non négociables

- Recopie le texte de la Pièce tel quel, dans son ordre : ne reformule, ne résume, ne corrige et ne complète rien. Seule la mise en forme devient du Markdown (titres, listes, gras).
- N'invente jamais un fait : un passage illisible est signalé par « [illisible] ».
- Ne modifie ni la Pièce ni aucun fichier du Profil.
- Ne cherche rien sur le web : tout est dans la Pièce.
`;
}

// claude -p needs a message: the fixed prompt above says everything (ADR-0003)
export const CONVERSION_REQUEST = 'Convertis la Pièce en Markdown.';
