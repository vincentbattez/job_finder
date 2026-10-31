import type { ERROR_EN } from '#/domain/catalogue/en/error.ts';

export const ERROR_FR: typeof ERROR_EN = {
  quote: '« {{text}} »',
  orSeparator: ' ou ',

  unexpected: 'Erreur inattendue : {{reason}}\nRelancer ; si elle revient, la signaler avec ce message.',
  invalidInput: 'Saisie invalide :\n{{problem}}\nLa corriger, puis réessayer.',
  invalidInputIssue: '« {{path}} » : {{message}}',
  unknownIntent: 'Ce bouton ne fait rien : recharger la page.',
  moduleFailure: '{{detail}}',

  dataLayoutMixed:
    "Le dossier de données mélange l'ancienne et la nouvelle disposition : « {{frenchPath}} » et « {{englishPath}} » existent tous deux. Fusionner le premier dans le second à la main, le supprimer, puis relancer.",
  dataLayoutUnexpected:
    "Le dossier de données a une entrée inattendue : « {{frenchPath}} » n'est pas du type que l'outil connaît. La déplacer hors du dossier de données, puis relancer.",
  configInvalid:
    "Config invalide : {{configPath}}\n{{problem}}\nLa corriger pour qu'elle soit importée en base, ou la supprimer : les Candidats et leurs Veilles se règlent désormais dans le front.",
  configKeysMixed:
    "La config {{configPath}} contient à la fois l'ancienne clé « {{frenchKey}} » et son nouveau nom « {{englishKey}} ». Ne garder que « {{englishKey}} », en y fusionnant ce que contient « {{frenchKey}} », puis relancer.",
  detectionRunning:
    'Une Détection est déjà en cours, lancée le {{startedAt, datetime(dateStyle: medium; timeStyle: short; timeZone: Europe/Paris)}} : attendre son verdict, puis la relancer au besoin.',
  detectionInterrupted: 'Interrompue : la Détection s’est arrêtée avant la fin, sans verdict. La relancer.',

  missingJobDescription:
    "Fiche de poste introuvable pour l'Offre {{reference}} : {{filePath}}. La remettre à cet emplacement, d'où l'outil la lit.",

  unknownCandidate: 'Candidat inconnu : {{candidateId}}. « jf candidates » liste les Candidats.',
  invalidCandidateId:
    "« {{candidateId}} » n'est pas un identifiant de Candidat : des minuscules sans accent et des chiffres, séparés par des « - », comme « lea » ou « jean-pierre ».",
  emptyCandidateName: 'Le nom du Candidat est vide : le renseigner.',
  duplicateCandidateId: "Un Candidat a déjà l'identifiant {{candidateId}} : en choisir un autre.",
  invalidDefaultDeadlinePeriod: 'Le Délai par défaut est un nombre entier de mois, au moins 1.',
  unknownPosting: 'Offre inconnue : {{reference}}. « jf list <candidat> » liste les Offres.',
  ambiguousPosting:
    "Plusieurs Offres ont la référence {{reference}}, chez des Candidats différents : leurs Veilles suivent la même Source, et l'outil ne sait pas encore choisir entre elles. Le signaler pour qu'il les distingue.",

  unknownWatch: "{{candidateName}} n'a pas de Veille {{watchId}} : recharger la page de son Profil.",
  unknownSource: 'Source inconnue : {{sourceId}}. En choisir une parmi {{knownList}} dans les Veilles du Profil.',
  unknownSourceOfWatch:
    'Source inconnue pour la Veille {{watchId}} : {{sourceId}}. En choisir une parmi {{knownList}} dans les Veilles du Profil.',
  watchParameters:
    "La Veille {{watchId}} ne donne pas à la Source {{sourceName}} les Paramètres qu'elle attend : corriger {{labels}} dans le Profil de son Candidat.",
  sourceParameters: "La Source {{sourceName}} attend d'autres Paramètres : renseigner {{labels}}.",
  notificationsNotSent: '{{failures}}',

  statusChange: "L'Offre {{reference}} est {{statusLabel}} : elle ne peut passer qu'en {{nextLabels}}.",
  toApplyAfterOutcome:
    "L'Offre {{reference}} a un résultat : la remettre En cours d'abord, seule une Offre Postulée sans Entretien revient À traiter.",
  toApplyWithInterview:
    "L'Offre {{reference}} a un Entretien : sa Lettre a été envoyée, elle ne revient pas À traiter.",
  letterFrozen:
    "L'Offre {{reference}} a été Postulée : sa Lettre retenue est figée telle qu'envoyée. Elle ne se modifie plus, ne se régénère plus et ne se remplace plus par une autre Version.",

  interviewWithoutApplication:
    "L'Offre {{reference}} est À traiter : la marquer Postulée d'abord, un Entretien appartient à sa Candidature.",
  unknownInterview:
    "L'Offre {{reference}} n'a pas d'Entretien {{number}}. « jf interviews {{reference}} » liste ses Entretiens.",
  interviewRequired:
    "« {{artifactLabel}} » prépare un Entretien : donner son numéro après les autres arguments. « jf interviews {{reference}} » liste les Entretiens de l'Offre {{reference}}.",
  interviewNotExpected:
    "« {{artifactLabel}} » appartient à l'Offre {{reference}}, pas à l'un de ses Entretiens : ne donner aucun numéro d'Entretien.",

  unknownModule: 'Module inconnu : {{name}}. Modules : {{names}}.',
  unknownArtifact: 'Artefact inconnu : {{name}}. Artefacts : {{names}}.',
  missingArtifactForFront:
    "L'Offre {{reference}} n'a pas de {{missingLabel}} retenue, sur laquelle s'appuie la {{moduleLabel}} : lancez d'abord la {{missingLabel}}.",
  missingArtifactForCli:
    "L'Offre {{reference}} n'a pas de {{missingLabel}} retenue, sur laquelle s'appuie la {{moduleLabel}}. La produire d'abord : {{command}}.",
  missingOutput: 'Le fichier attendu {{outputPath}} est absent.',
  emptyOutput: 'Le fichier attendu {{outputPath}} est vide.',
  malformedOutput: 'Le fichier {{outputPath}} est mal formé : {{formatError}}.',
  notImported: "L'Offre {{reference}} n'a pas été importée : ses champs viennent de sa Source, sans extraction.",
  unknownJob: 'Job inconnu : {{jobId}}. Son numéro est celui que « jf run » ou « jf import » a affiché.',
  workerNotRunning:
    "Le worker ne tourne pas : le job {{jobId}} n'avance pas. Le démarrer : « lpm service worker start -p job_finder », puis lire « lpm logs worker -p job_finder » s'il s'arrête encore.",
  jobOverdue:
    'Le job {{jobId}} tourne depuis plus de {{minutes}} minutes, au-delà de sa durée maximale : le worker est bloqué. Le redémarrer : « lpm service worker restart -p job_finder », ce qui fait échouer le job ; puis relancer le module.',
  interruptedJob:
    "Interrompu : le worker s'est arrêté pendant ce job. Relancer le module en crée une nouvelle Version.",
  visualizationNotEditable:
    "La Visualisation ne se modifie pas à la main : elle reprend la Fiche d'entretien retenue. Corrigez celle-ci, puis relancez la Visualisation de l'Offre {{reference}}.",
  noChosenVersionToEdit:
    "L'Offre {{reference}} n'a pas de Version retenue de {{artifact}} à modifier : « {{command}} » en produit une.",
  draftNotEditable:
    "Le Brouillon ne se modifie jamais : il garde ce que l'IA a écrit. Corrigez la Lettre de l'Offre {{reference}}.",
  unknownVersion:
    "Version inconnue : {{artifact}} v{{number}} de l'Offre {{reference}}. « {{command}} » liste ses Versions.",
  versionFailed:
    "La Version {{artifact}} v{{number}} de l'Offre {{reference}} est en échec : seule une Version prête peut être retenue.",
  versionRunning:
    "La Version {{artifact}} v{{number}} de l'Offre {{reference}} est en cours : seule une Version prête peut être retenue.",
  notAVersionFile:
    "« {{fileName}} » n'est pas un fichier de la Version retenue de {{artifact}} de l'Offre {{reference}}.",
  visualizationWithoutPage:
    "La Visualisation v{{number}} de l'Offre {{reference}} n'a pas de page : relancez la Visualisation.",
  noChosenLetter: "L'Offre {{reference}} n'a pas de Lettre retenue. La produire : jf run letter {{reference}}.",

  invalidProfileFileName:
    "« {{fileName}} » n'est pas un nom de fichier du Profil : un nom sans dossier, en lettres, chiffres, « - », « _ » ou « . », terminé par « .md ».",
  missingProfileFile:
    "Le Profil de {{candidateName}} n'a pas de fichier « {{fileName}} ». La page Profil ou « jf profile {{candidateId}} » le crée.",
  duplicateProfileFile: 'Le Profil de {{candidateName}} a déjà un fichier « {{fileName}} ». Choisir un autre nom.',
  noFileReceived: 'Aucun fichier reçu. Déposer un PDF ou le choisir, puis recommencer.',
  invalidUploadName:
    "« {{fileName}} » n'est pas un nom de Pièce : un nom sans dossier, en lettres, chiffres, « - », « _ » ou « . », terminé par « .pdf ».",
  notAPdf: "« {{fileName}} » n'est pas un PDF. Exporter le document en PDF, puis le déposer à nouveau.",
  uploadTooLarge:
    "« {{fileName}} » dépasse {{maxMegabytes}} Mo. Réduire le PDF (moins d'images), puis le déposer à nouveau.",
  missingUpload: "Le Profil de {{candidateName}} n'a pas de Pièce « {{fileName}} ».",
  uploadGone: "« {{upload}} » n'est plus dans le Profil de {{candidateName}} : la déposer à nouveau pour la convertir.",
  conversionWithoutFile: "La conversion de « {{upload}} » n'a écrit aucun fichier Markdown.\n{{log}}",
  conversionRefused:
    "La conversion de « {{upload}} » est refusée : « {{fileName}} » n'est ni « cv.md », ni une lettre « letter-<employer>-<year>.md », ni une Annexe « annex-<subject>.md ».",
  conversionOverwrite:
    "« {{upload}} » se convertit en « {{fileName}} », que le Profil a déjà : il n'est pas écrasé. Supprimer ou renommer « {{fileName}} », puis relancer la conversion.",

  sessionFailed: 'La session Claude Code a échoué : son journal dit pourquoi. Relancer le module.',
  sessionStopped: "Claude Code s'est arrêté (code {{exitCode}}) : {{output}}",
  sessionTimedOut:
    "La session Claude Code a dépassé sa durée maximale ({{minutes}} minutes) : elle a été arrêtée. Relancer le module ; si cela revient, « ssh {{host}} », puis lancer « claude » seul pour voir ce qu'il attend (connexion, limite d'usage, une question).",
  claudeLoginRequired:
    "Claude Code a refusé la session : il n'est plus connecté sur {{host}}. S'y reconnecter : « ssh {{host}} », lancer « claude » puis taper « /login », puis relancer le module.\n{{result}}",
  claudeUsageLimit:
    "Claude Code a atteint sa limite d'usage sur {{host}}. Relancer le module une fois la limite levée, à l'heure qu'il indique.\n{{result}}",
  sessionKilled:
    'Claude Code a été arrêté par le signal {{signal}} : son processus a été tué, ou la machine a manqué de mémoire. Relancer ; si cela revient, « ssh {{host}} », puis lancer « claude » seul pour lire son message.',
  sessionNotLaunched: "Impossible de lancer Claude Code ({{reason}}). Installer « claude » et s'y connecter.",
  interactiveSessionFailed:
    "La session Claude Code s'est arrêtée en erreur (code {{status}}). Relancer la commande ; si l'erreur revient, lancer « claude » seul pour lire son message.",
  conversionSessionFailed: "Claude Code n'a pas converti la Pièce « {{upload}} » : {{log}}",
  extractionSessionFailed: "Claude Code n'a pas relevé les champs de la Fiche de poste : {{log}}",
  invalidExtraction: 'Les champs relevés dans la Fiche de poste ne sont pas valables ({{fileName}}) : {{problem}}.',
  extractionNotWritten: 'la session ne les a pas écrits',
  extractionInvented: "ne figure pas tel quel dans la Fiche de poste : la session l'a inventé",
  noLevelOneHeading: 'il ne commence pas par un titre de niveau 1 (« # »)',
  noSourcesSection: "il n'a pas de section « ## Sources » avec au moins un lien",
  notACompletePage: "ce n'est pas une page HTML complète, de « <!DOCTYPE html> » à « </html> »",
  hasScript: "il contient un script, que le front n'exécute pas",
  recipientsFormat: 'il ne suit pas le format demandé ({{detail}})',
  inventedAddress: "l'adresse {{email}} ne figure pas dans le champ {{field}} de l'Offre",

  parameterUndeclared:
    "Le Paramètre {{parameterName}} du module {{moduleName}} n'est pas déclaré avec parameter() : l'y déclarer ainsi dans le module.",

  postingFolderNotMoved:
    "Le dossier de l'Offre {{reference}} n'a pas pu suivre son nouveau titre, vers {{to}} : {{reason}}. L'Offre garde son titre : libérer cet emplacement, puis relancer l'extraction.",

  apiGeoUnreachable: 'API Géo est injoignable ({{url}}) : {{reason}}. Vérifier la connexion, puis relancer.',
  apiGeoStatus: 'API Géo a répondu HTTP {{status}} pour {{url}}. Relancer plus tard.',
  apiGeoFormatChanged:
    'API Géo a répondu dans un format inattendu pour {{url}} : {{problem}}. Son API a peut-être changé : le signaler, les Offres restent hors de la carte en attendant.',
  postingsNotLocated:
    'Offres enregistrées sans coordonnées, hors de la carte jusqu’à ce que la prochaine Détection les localise : {{reason}}',
};
