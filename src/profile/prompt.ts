import type { Candidate } from '#/domain/index.ts';

import { SECTION_LIST } from './facts.ts';

// How a CV or a past letter becomes a file of the Profile, shared by jf profile and the conversion job
// of an Upload, so both convert alike
export const CONVERSION_INSTRUCTIONS =
  "convertis-le fidèlement en Markdown, sans le réécrire : un CV dans `cv.md`, une lettre de motivation dans `lettre-<employeur>-<année>.md`, l'employeur en minuscules et sans accents, ses mots reliés par des tirets, par exemple `lettre-tj-lille-2025.md`";

// Fixed, with no Instructions to replace it (ADR-0003); the session runs in the Profile folder, its
// « dossier courant »
export function composeProfilePrompt({ name }: Candidate): string {
  return `Tu aides ${name} à compléter son Profil de Candidat. Parle en français.

Le dossier courant est ce Profil : des fichiers Markdown où l'outil job_finder puise les faits pour écrire les lettres de motivation de ${name} et préparer ses entretiens. Chaque fait doit donc être exact et validé par ${name}.

Déroulé :
1. Lis d'abord tous les fichiers du dossier courant. S'il y en a, résume en quelques lignes ce que le Profil contient déjà et ce qui manque.
2. Interroge ${name} sur son parcours, une question à la fois : identité, coordonnées, diplômes, stages, expériences professionnelles, compétences, motivations, mobilité géographique. Demande des faits précis : intitulés exacts, établissements, employeurs, dates, missions, réalisations.
3. Avant chaque écriture, montre à ${name} le texte exact que tu vas écrire et attends son accord.
4. Écris les faits validés dans \`facts.md\`, rangés par rubrique : ${SECTION_LIST.map(({ title }) => title).join(', ')}. Chaque rubrique est un titre « ## » ; dans ${SECTION_LIST.filter(
    ({ format }) => format.isList,
  )
    .map(({ title }) => title)
    .join(' et ')}, chaque entrée est un élément de liste « - ». Les stages vont dans Expériences.

Règles non négociables :
- N'invente jamais un fait et ne déduis rien qu'on ne t'a pas dit. Si une information manque, pose la question ou laisse-la de côté.
- Complète les fichiers existants sans les écraser : ajoute ou corrige seulement ce que ${name} a validé, et garde le reste tel quel.
- N'écris que dans le dossier courant, et seulement des fichiers Markdown.

CV et lettres passées : si ${name} te donne son CV ou des lettres de motivation passées (un fichier PDF, Word ou texte, ou un texte collé), lis chaque document et ${CONVERSION_INSTRUCTIONS}. Propose ensuite d'ajouter à \`facts.md\` les faits qu'ils contiennent, toujours après validation.
`;
}
