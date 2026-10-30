import type { CLI_EN } from '#/domain/catalogue/en/cli.ts';

const DEADLINE_FORMAT = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });
const CREATED_AT_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Paris',
});

const INSTRUCTIONS_USAGE =
  'Usage : jf instructions <candidat> [<module> [default|replace|delete]], par exemple jf instructions lea letter.';

export const CLI_FR: typeof CLI_EN = {
  help: {
    title: "jf : veille d'offres et préparation des candidatures",
    usage: 'Usage : jf <commande>',
    commandsHeading: 'Commandes :',
    help: 'Affiche cette aide',
  },
  unknownCommand: (commandName) => `Commande inconnue : ${commandName}. « jf help » liste les commandes.`,
  obsoleteConfig: (configPath) =>
    `${configPath} n'est plus lu : son contenu est en base, et les Candidats, leurs Veilles et le Délai par défaut se règlent désormais dans le front. Le supprimer.`,
  unreadableFile: (filePath, reason) => `Impossible de lire le fichier ${filePath} (${reason}). Vérifier son chemin.`,

  formatDeadline: (deadline) => DEADLINE_FORMAT.format(deadline),
  inZone: 'Zone',
  outOfZone: 'hors Zone',
  repostOf: (reference) => `Republication de ${reference}`,
  repostedAs: (reference) => `Republiée en ${reference}`,

  answered: (question, label) => `${question} : ${label}\n`,
  ask: (question, count) => `${question} (1 à ${String(count)}) : `,
  noChoice: 'Abandonné : aucun choix.',
  invalidChoice: (answer) => `Choix invalide : ${answer}. Relancer la commande.`,
  candidateQuestion: 'Candidat',
  noCandidate: 'Aucun Candidat : en créer un dans la page Candidats du front.',
  postingQuestion: 'Offre à modifier',
  noPosting: (candidateName) => `Aucune Offre pour ${candidateName} : « jf detect » cherche les nouvelles Offres.`,
  artifactQuestion: 'Artefact à modifier',
  chosenVersionLabel: (artifactLabel, number) => `${artifactLabel} (v${String(number)}, retenue)`,
  noArtifact: (reference) =>
    `L'Offre ${reference} n'a aucun Artefact à modifier : « jf run research ${reference} » produit sa Recherche.`,

  candidatesDescription: 'Liste les Candidats, que la page Candidats du front crée et renomme',
  listDescription: "Liste les Offres d'un Candidat : jf list <candidat>",
  listUsage: 'Usage : jf list <candidat>. « jf candidates » liste les Candidats.',

  detectDescription: 'Cherche les nouvelles Offres de chaque Veille',
  detectionSummary: (watchId, candidateId, newCount, isFirstLaunch) =>
    `Veille ${watchId} (${candidateId}) : ${newCount === 0 ? 'aucune nouvelle Offre' : String(newCount) + ' nouvelles Offres'}${isFirstLaunch ? ', premier lancement : importées sans rien déclencher' : ''}\n`,
  nearMissHeading: 'Titres écartés de justesse :\n',

  importDescription:
    "Importe une Fiche de poste en Markdown trouvée ailleurs : le worker en relève les champs avec Claude Code, puis met sa Recherche en file ; Candidat proposé si absent, --wait attend l'extraction : jf import <fichier> [<candidat>] [--wait]",
  importUsage: 'Usage : jf import <fichier> [<candidat>] [--wait], par exemple jf import offre-greffier.md lea.',
  imported: (reference, jobId) =>
    `Offre ${reference} importée, extraction de ses champs en file (job ${String(jobId)}).\n`,
  importQueued: (candidateId) =>
    `Le worker la lance, puis met sa Recherche en file. « jf list ${candidateId} » la montre.\n`,
  extractionWaiting: 'Attente du worker (service lpm worker) : Claude Code relève les champs…\n',
  extractionFailed: (reference, log) =>
    `Extraction des champs de l'Offre ${reference} en échec :\n${log}\nRelancer : jf run extraction ${reference}`,
  extracted: (postingLine, reference) =>
    `${postingLine}\nSa Recherche est en file : « jf versions ${reference} research » la suit.\n`,

  runDescription:
    "Met en file une nouvelle Version d'un Artefact, que le worker produit avec Claude Code ; --wait attend la fin : jf run research|letter|brief|visualization <offre> [--wait]",
  runUsage: 'Usage : jf run <module> <offre> [--wait], par exemple jf run research 2026-2445600.',
  queued: (module, reference, jobId) => `${module} de l'Offre ${reference} en file (job ${String(jobId)}).\n`,
  runQueued: (versionsCommand) => `Le worker la produira. « ${versionsCommand} » suit ses Versions.\n`,
  runWaiting: 'Attente du worker (service lpm worker) : Claude Code peut prendre plusieurs minutes…\n',
  runFailed: (name, log, module, reference) => `${name} en échec :\n${log}\nRelancer : jf run ${module} ${reference}`,
  runReady: (name, versionsCommand) => `${name} prête et retenue. « ${versionsCommand} » liste ses Versions.\n`,

  recipientsDescription: 'Affiche à qui adresser la candidature, selon la Lettre retenue : jf recipients <offre>',
  recipientsUsage: 'Usage : jf recipients <offre>, par exemple jf recipients 2026-2445600.',
  fieldLabelBySource: { applicationEmail: 'mail de candidature', contact1: 'contact 1', contact2: 'contact 2' },
  recipient: (address) => `Destinataire : ${address ?? "aucune adresse dans l'Offre"}`,
  ccList: (addressList) => `Copie : ${addressList.length === 0 ? 'aucune' : addressList.join(', ')}`,
  salutation: (text) => `Formule d'appel : ${text}`,
  justification: (text) => `Justification : ${text}`,

  versionsDescription: "Liste les Versions d'un Artefact : jf versions <offre> research",
  versionsUsage: 'Usage : jf versions <offre> <artifact>, par exemple jf versions 2026-2445600 research.',
  versionStateLabelByState: { running: 'en cours', ready: 'prête', failed: 'en échec' },
  chosenVersion: 'retenue',
  candidateInstructions: 'Consignes du Candidat',
  defaultInstructions: 'Consignes par défaut',
  formatCreatedAt: (createdAt) => CREATED_AT_FORMAT.format(createdAt),
  chooseDescription: "Change la Version retenue d'un Artefact : jf choose <offre> research <version>",
  chooseUsage: 'Usage : jf choose <offre> <artifact> <version>, par exemple jf choose 2026-2445600 research 2.',
  versionChosen: (artifact, version, reference) => `${artifact} ${version} retenue pour l'Offre ${reference}.\n`,

  statusCommandDescription: (description, name) => `${description} : jf ${name} <offre>`,
  statusUsage: (name) => `Usage : jf ${name} <offre>. « jf list <candidat> » liste les Offres.`,
  statusChanged: (reference, statusLabel) => `${reference} : ${statusLabel}\n`,
  applyDescription:
    'Passe une Offre en Postulée, avec ou sans Lettre, ce qui fige sa Lettre pour de bon ; remet en Postulée une Offre Postulée puis Archivée',
  archiveDescription: 'Passe une Offre en Archivée, Postulée ou non',
  toApplyDescription: "Remet À traiter une Offre Archivée qui n'a jamais été Postulée",

  profileDescription: "Complète le Profil d'un Candidat avec Claude Code : jf profile <candidat>",
  profileUsage: 'Usage : jf profile <candidat>. « jf candidates » liste les Candidats.',
  editDescription:
    'Modifie un Artefact avec Claude Code, Offre et Artefact proposés si absents : jf edit [<offre> [<artifact>]]',

  instructionsDescription:
    "Montre, remplace (lues sur l'entrée standard) ou supprime les Consignes d'un module : jf instructions <candidat> [<module> [default|replace|delete]]",
  instructionsUsage: `${INSTRUCTIONS_USAGE} « jf candidates » liste les Candidats.`,
  unknownOperation: (operation) => `Opération inconnue : ${operation}. ${INSTRUCTIONS_USAGE}`,
  instructionsHeading: (module, isCandidate) =>
    `Consignes ${isCandidate ? 'du Candidat' : 'par défaut'} de ${module} :\n`,
  typeInstructions: 'Tapez ou collez les Consignes, puis Ctrl-D :\n',
  instructionsReplaced: (module) => `${module} suivra ces Consignes du Candidat dans ses prochaines Versions.\n`,
  instructionsDeleted: (module) => `${module} revient à ses Consignes par défaut.\n`,

  workerReady: 'Worker prêt : il lance les jobs en file, un à la fois.\n',
  jobFailed: (firstLine) => `en échec : ${firstLine}`,
  conversionDone: 'rangée dans le Profil',
  conversionJob: (jobId, upload, candidateId, outcome) =>
    `job ${String(jobId)}, conversion de la Pièce ${upload} de ${candidateId} : ${outcome}\n`,
  artifactDone: 'prête et retenue',
  artifactJob: (jobId, artifact, reference, outcome) =>
    `job ${String(jobId)}, ${artifact} de l'Offre ${reference} : ${outcome}\n`,
};
