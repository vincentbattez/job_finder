import type { ERROR_EN } from '#/domain/catalogue/en/error.ts';

const quote = (text: string) => `« ${text} »`;

export const ERROR_FR: typeof ERROR_EN = {
  dataLayoutMixed: (frenchPath, englishPath) =>
    `Le dossier de données mélange l'ancienne et la nouvelle disposition : ${quote(frenchPath)} et ${quote(englishPath)} existent tous deux. Fusionner le premier dans le second à la main, le supprimer, puis relancer.`,
  dataLayoutUnexpected: (frenchPath) =>
    `Le dossier de données a une entrée inattendue : ${quote(frenchPath)} n'est pas du type que l'outil connaît. La déplacer hors du dossier de données, puis relancer.`,
  configInvalid: (configPath, problem) =>
    `Config invalide : ${configPath}\n${problem}\nLa corriger pour qu'elle soit importée en base, ou la supprimer : les Candidats et leurs Veilles se règlent désormais dans le front.`,
  configKeysMixed: (configPath, frenchKey, englishKey) =>
    `La config ${configPath} contient à la fois l'ancienne clé ${quote(frenchKey)} et son nouveau nom ${quote(englishKey)}. Ne garder que ${quote(englishKey)}, en y fusionnant ce que contient ${quote(frenchKey)}, puis relancer.`,

  missingJobDescription: (reference, filePath) =>
    `Fiche de poste introuvable pour l'Offre ${reference} : ${filePath}. La remettre à cet emplacement, d'où l'outil la lit.`,

  unknownCandidate: (candidateId) => `Candidat inconnu : ${candidateId}. « jf candidates » liste les Candidats.`,
  invalidCandidateId: (candidateId) =>
    `${quote(candidateId)} n'est pas un identifiant de Candidat : des minuscules sans accent et des chiffres, séparés par des « - », comme « lea » ou « jean-pierre ».`,
  emptyCandidateName: 'Le nom du Candidat est vide : le renseigner.',
  duplicateCandidateId: (candidateId) => `Un Candidat a déjà l'identifiant ${candidateId} : en choisir un autre.`,
  invalidDefaultDeadlinePeriod: 'Le Délai par défaut est un nombre entier de mois, au moins 1.',
  unknownPosting: (reference) => `Offre inconnue : ${reference}. « jf list <candidat> » liste les Offres.`,
  ambiguousPosting: (reference) =>
    `Plusieurs Offres ont la référence ${reference}, chez des Candidats différents : leurs Veilles suivent la même Source, et l'outil ne sait pas encore choisir entre elles. Le signaler pour qu'il les distingue.`,

  unknownWatch: (candidateName, watchId) =>
    `${candidateName} n'a pas de Veille ${watchId} : recharger la page de son Profil.`,
  unknownSource: (sourceId, knownList, watchId) => {
    const ofWatch = watchId === undefined ? '' : ` pour la Veille ${watchId}`;
    return `Source inconnue${ofWatch} : ${sourceId}. En choisir une parmi ${knownList} dans les Veilles du Profil.`;
  },
  watchParameters: (watchId, sourceName, labelList) =>
    `La Veille ${watchId} ne donne pas à la Source ${sourceName} les Paramètres qu'elle attend : corriger ${labelList.map((label) => quote(label)).join(', ')} dans le Profil de son Candidat.`,
  sourceParameters: (sourceName, labelList) =>
    `La Source ${sourceName} attend d'autres Paramètres : renseigner ${labelList.map((label) => quote(label)).join(', ')}.`,

  statusChange: (reference, statusLabel, nextLabelList, hasBeenApplied) =>
    `L'Offre ${reference} est ${statusLabel} : elle ne peut passer qu'en ${nextLabelList.join(' ou ')}${hasBeenApplied ? ", Postulée ne s'annulant jamais : sa Lettre retenue est celle envoyée" : ''}.`,
  letterFrozen: (reference) =>
    `L'Offre ${reference} a été Postulée : sa Lettre retenue est figée telle qu'envoyée. Elle ne se modifie plus, ne se régénère plus et ne se remplace plus par une autre Version.`,

  unknownModule: (name, nameList) => `Module inconnu : ${name}. Modules : ${nameList.join(', ')}.`,
  unknownArtifact: (name, nameList) => `Artefact inconnu : ${name}. Artefacts : ${nameList.join(', ')}.`,
  missingArtifactForFront: (reference, missingLabel, moduleLabel) =>
    `L'Offre ${reference} n'a pas de ${missingLabel} retenue, sur laquelle s'appuie la ${moduleLabel} : lancez d'abord la ${missingLabel}.`,
  missingArtifactForCli: (reference, missingLabel, moduleLabel, missingArtifact) =>
    `L'Offre ${reference} n'a pas de ${missingLabel} retenue, sur laquelle s'appuie la ${moduleLabel}. La produire d'abord : jf run ${missingArtifact} ${reference}.`,
  missingOutput: (outputPath) => `Le fichier attendu ${outputPath} est absent.`,
  emptyOutput: (outputPath) => `Le fichier attendu ${outputPath} est vide.`,
  malformedOutput: (outputPath, formatError) => `Le fichier ${outputPath} est mal formé : ${formatError}.`,
  notImported: (reference) =>
    `L'Offre ${reference} n'a pas été importée : ses champs viennent de sa Source, sans extraction.`,
  unknownJob: (jobId) =>
    `Job inconnu : ${String(jobId)}. Son numéro est celui que « jf run » ou « jf import » a affiché.`,
  interruptedJob:
    "Interrompu : le worker s'est arrêté pendant ce job. Relancer le module en crée une nouvelle Version.",
  visualizationNotEditable: (reference) =>
    `La Visualisation ne se modifie pas à la main : elle reprend la Fiche d'entretien retenue. Corrigez celle-ci, puis relancez la Visualisation de l'Offre ${reference}.`,
  noChosenVersionToEdit: (reference, artifact) =>
    `L'Offre ${reference} n'a pas de Version retenue de ${artifact} à modifier : « jf run ${artifact} ${reference} » en produit une.`,
  draftNotEditable: (reference) =>
    `Le Brouillon ne se modifie jamais : il garde ce que l'IA a écrit. Corrigez la Lettre de l'Offre ${reference}.`,
  unknownVersion: (reference, artifact, number) =>
    `Version inconnue : ${artifact} v${String(number)} de l'Offre ${reference}. « jf versions ${reference} ${artifact} » liste ses Versions.`,
  versionNotReady: (reference, artifact, number, isFailed) =>
    `La Version ${artifact} v${String(number)} de l'Offre ${reference} est ${isFailed ? 'en échec' : 'en cours'} : seule une Version prête peut être retenue.`,
  notAVersionFile: (fileName, artifact, reference) =>
    `${quote(fileName)} n'est pas un fichier de la Version retenue de ${artifact} de l'Offre ${reference}.`,
  visualizationWithoutPage: (reference, number) =>
    `La Visualisation v${String(number)} de l'Offre ${reference} n'a pas de page : relancez la Visualisation.`,
  noChosenLetter: (reference) =>
    `L'Offre ${reference} n'a pas de Lettre retenue. La produire : jf run letter ${reference}.`,

  invalidProfileFileName: (fileName) =>
    `${quote(fileName)} n'est pas un nom de fichier du Profil : un nom sans dossier, en lettres, chiffres, « - », « _ » ou « . », terminé par « .md ».`,
  missingProfileFile: (candidateName, fileName, candidateId) =>
    `Le Profil de ${candidateName} n'a pas de fichier ${quote(fileName)}. La page Profil ou « jf profile ${candidateId} » le crée.`,
  duplicateProfileFile: (candidateName, fileName) =>
    `Le Profil de ${candidateName} a déjà un fichier ${quote(fileName)}. Choisir un autre nom.`,
  noFileReceived: 'Aucun fichier reçu. Déposer un PDF ou le choisir, puis recommencer.',
  invalidUploadName: (fileName) =>
    `${quote(fileName)} n'est pas un nom de Pièce : un nom sans dossier, en lettres, chiffres, « - », « _ » ou « . », terminé par « .pdf ».`,
  notAPdf: (fileName) => `${quote(fileName)} n'est pas un PDF. Exporter le document en PDF, puis le déposer à nouveau.`,
  uploadTooLarge: (fileName, maxMegabytes) =>
    `${quote(fileName)} dépasse ${String(maxMegabytes)} Mo. Réduire le PDF (moins d'images), puis le déposer à nouveau.`,
  missingUpload: (candidateName, fileName) => `Le Profil de ${candidateName} n'a pas de Pièce ${quote(fileName)}.`,
  uploadGone: (upload, candidateName) =>
    `${quote(upload)} n'est plus dans le Profil de ${candidateName} : la déposer à nouveau pour la convertir.`,
  conversionWithoutFile: (upload, log) => `La conversion de ${quote(upload)} n'a écrit aucun fichier Markdown.\n${log}`,
  conversionRefused: (upload, fileName) =>
    `La conversion de ${quote(upload)} est refusée : ${quote(fileName)} n'est ni « cv.md » ni une lettre « letter-<employer>-<year>.md ».`,
  conversionOverwrite: (upload, fileName) =>
    `${quote(upload)} se convertit en ${quote(fileName)}, que le Profil a déjà : il n'est pas écrasé. Supprimer ou renommer ${quote(fileName)}, puis relancer la conversion.`,

  sessionStopped: (exitCode, output) => `Claude Code s'est arrêté (code ${String(exitCode)}) : ${output}`,
  sessionNotLaunched: (reason) =>
    `Impossible de lancer Claude Code (${reason}). Installer « claude » et s'y connecter.`,
  interactiveSessionFailed: (status) =>
    `La session Claude Code s'est arrêtée en erreur (code ${String(status)}). Relancer la commande ; si l'erreur revient, lancer « claude » seul pour lire son message.`,
  conversionSessionFailed: (upload, log) => `Claude Code n'a pas converti la Pièce ${quote(upload)} : ${log}`,
  extractionSessionFailed: (log) => `Claude Code n'a pas relevé les champs de la Fiche de poste : ${log}`,
  invalidExtraction: (fileName, problem) =>
    `Les champs relevés dans la Fiche de poste ne sont pas valables (${fileName}) : ${problem}.`,
  extractionNotWritten: 'la session ne les a pas écrits',
  extractionInvented: "ne figure pas tel quel dans la Fiche de poste : la session l'a inventé",
  noLevelOneHeading: 'il ne commence pas par un titre de niveau 1 (« # »)',
  noSourcesSection: "il n'a pas de section « ## Sources » avec au moins un lien",
  notACompletePage: "ce n'est pas une page HTML complète, de « <!DOCTYPE html> » à « </html> »",
  hasScript: "il contient un script, que le front n'exécute pas",
  recipientsFormat: (detail) => `il ne suit pas le format demandé (${detail})`,
  inventedAddress: (email, field) => `l'adresse ${email} ne figure pas dans le champ ${field} de l'Offre`,

  apiGeoUnreachable: (url, reason) =>
    `API Géo est injoignable (${url}) : ${reason}. Vérifier la connexion, puis relancer.`,
  apiGeoStatus: (url, status) => `API Géo a répondu HTTP ${String(status)} pour ${url}. Relancer plus tard.`,
};
