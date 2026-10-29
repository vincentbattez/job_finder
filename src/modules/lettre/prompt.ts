import type { IPromptInput } from '#/ai-module/index.ts';
import { FICHE_DE_POSTE_FILE_NAME } from '#/domain/index.ts';

import { RECIPIENTS_FILE_NAME } from './acl/recipients.ts';

// The Brouillon the session writes, never modified, and the Lettre the Candidat corrects, its copy
export const BROUILLON_FILE_NAME = 'brouillon.md';
export const LETTRE_FILE_NAME = 'lettre.md';

function quote(field: string | null): string {
  return field === null ? 'non renseigné' : `« ${field.trim()} »`;
}

// The pairs Brouillon/Lettre the Candidat already sent, one folder per Postulée Offre
function describeSentLettres(sentList: IPromptInput['readVersionList']): string {
  if (sentList.length === 0) {
    return "Le Candidat n'a encore envoyé aucune Lettre.";
  }
  const folderList = sentList.map(({ reference, directory }) => `- Offre ${reference} : \`${directory}\``);
  return `Les Lettres que le Candidat a déjà envoyées, une par dossier. Chaque dossier contient le Brouillon que l'outil avait écrit (\`${BROUILLON_FILE_NAME}\`) et la Lettre telle que le Candidat l'a corrigée puis envoyée (\`${LETTRE_FILE_NAME}\`). Compare chaque paire : ses corrections montrent son style et ce qu'il refuse, applique-les.
${folderList.join('\n')}`;
}

// The fixed part of the prompt of the Lettre: what it reads, what it writes and where, and the
// rules no Consignes can lift (ADR-0003). It runs in the folder of the Offre.
export function composeLettrePrompt({
  offre,
  outputDirectory,
  readVersionList,
  profilDirectory,
}: IPromptInput): string {
  const rechercheList = readVersionList.filter(({ artefact }) => artefact === 'recherche');
  const sentList = readVersionList.filter(({ artefact }) => artefact === 'lettre');
  return `Tu écris le Brouillon de la lettre de motivation d'un Candidat pour une Offre d'emploi, et tu recommandes à qui l'adresser. Écris en français.

## L'Offre

- Référence : ${offre.reference}
- Titre : ${offre.title}
- Employeur : ${offre.employer ?? 'non précisé'}
- Lieu d'affectation : ${offre.workplace ?? 'non précisé'}

Le dossier courant est celui de l'Offre.

## Ce que tu lis

Lis tout avant d'écrire :
- La Fiche de poste, telle qu'elle a été publiée : \`${FICHE_DE_POSTE_FILE_NAME}\`.
${rechercheList.map(({ filePath }) => `- La Recherche retenue, qui établit ce que les recruteurs attendent et dans quel contexte : \`${filePath}\`.`).join('\n')}
- Le Profil du Candidat, dans \`${profilDirectory}\` : les faits qu'il a validés, son CV et ses lettres passées, quand ils existent. Lis chacun de ses fichiers : c'est la seule source des faits sur le Candidat, et ses lettres passées donnent son style.
- ${describeSentLettres(sentList)}

## Les contacts de l'Offre, tels que publiés

- \`applicationEmail\`, le mail de candidature : ${quote(offre.applicationEmail)}
- \`contact1\`, la première personne à contacter : ${quote(offre.contact1)}
- \`contact2\`, la seconde personne à contacter : ${quote(offre.contact2)}

Ce sont des champs en texte libre : une adresse peut y être mêlée à un nom, à une fonction, à un téléphone ou à une consigne (« secrétariat en copie »), et un champ peut ne donner aucune adresse. Interprète-les, et lève l'ambiguïté entre eux : à qui envoyer, qui mettre en copie, à qui s'adresse la lettre.

## Ce que tu produis

1. \`${outputDirectory}/${BROUILLON_FILE_NAME}\` : le Brouillon, la lettre complète en Markdown, de la formule d'appel à la signature, prête à être corrigée puis collée dans un mail.
2. \`${outputDirectory}/${RECIPIENTS_FILE_NAME}\` : les destinataires recommandés, en JSON, exactement sous cette forme :

\`\`\`json
{
  "to": { "email": "adresse@exemple.fr", "source": "applicationEmail" },
  "ccList": [{ "email": "copie@exemple.fr", "source": "contact2" }],
  "salutation": { "text": "Madame la Présidente,", "source": "contact1" },
  "justification": "Pourquoi ces choix, en quelques phrases."
}
\`\`\`

- \`to\` : l'adresse à laquelle envoyer la candidature, ou \`null\` si aucun champ n'en donne.
- \`ccList\` : les adresses à mettre en copie, éventuellement aucune (\`[]\`).
- \`salutation\` : la formule d'appel de la lettre, la même que celle du Brouillon.
- \`source\` : le champ d'où vient l'information, \`applicationEmail\`, \`contact1\` ou \`contact2\`. Pour la formule d'appel, le champ qui nomme la personne ou la fonction à qui s'adresse la lettre, ou \`null\` pour une formule générique.
- \`email\` : l'adresse seule, recopiée telle qu'elle figure dans le champ \`source\`, sans nom ni texte autour.
- \`justification\` : pourquoi ce destinataire, ces copies et cette formule d'appel, en t'appuyant sur les champs.

## Règles non négociables

- N'invente jamais un fait sur le Candidat : diplômes, dates, stages, expériences, compétences, motivations, mobilité. Chaque fait vient de son Profil ou de ses Lettres déjà envoyées. Ne déduis rien qui n'y est pas écrit.
- Partout où la lettre a besoin d'un fait que tu n'as pas, écris à sa place un repère \`[à compléter : …]\` qui dit précisément ce qui manque, par exemple \`[à compléter : intitulé et année du master]\`. Mieux vaut dix repères qu'un seul fait inventé.
- N'invente aucun fait sur l'Offre ni sur l'employeur : appuie-toi sur la Fiche de poste et la Recherche retenue. N'invente aucune adresse : chacune figure dans le champ qu'elle cite.
- N'écris aucun autre fichier que ces deux-là, et ne modifie jamais la Fiche de poste, la Recherche, le Profil ni les Lettres déjà envoyées.
- Ne touche jamais au statut de l'Offre ni à la file de jobs de l'outil.
- Le message qui suit contient les Consignes du Candidat : elles disent comment écrire la lettre. Si elles contredisent ce que tu lis, les fichiers attendus ou ces règles, cette partie fixe l'emporte.
`;
}
