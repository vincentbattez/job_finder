import type { CLI_EN } from '#/domain/catalogue/en/cli.ts';

const INSTRUCTIONS_USAGE =
  'Usage : jf instructions <candidat> [<module> [default|replace|delete]], par exemple jf instructions lea letter.';

export const CLI_FR: typeof CLI_EN = {
  help: {
    title: "jf : veille d'offres et préparation des candidatures",
    usage: 'Usage : jf <commande>',
    commandsHeading: 'Commandes :',
    help: 'Affiche cette aide',
  },
  unknownCommand: 'Commande inconnue : {{commandName}}. « jf help » liste les commandes.',
  obsoleteConfig:
    "{{configPath}} n'est plus lu : son contenu est en base, et les Candidats, leurs Veilles et le Délai par défaut se règlent désormais dans le front. Le supprimer.",
  unreadableFile: 'Impossible de lire le fichier {{filePath}} ({{reason}}). Vérifier son chemin.',

  deadline: '{{deadline, datetime(timeZone: UTC)}}',
  inZone: 'Zone',
  outOfZone: 'hors Zone',
  repostOf: 'Republication de {{reference}}',
  repostedAs: 'Republiée en {{reference}}',

  answered: '{{question}} : {{label}}\n',
  ask: '{{question}} (1 à {{itemCount}}) : ',
  noChoice: 'Abandonné : aucun choix.',
  invalidChoice: 'Choix invalide : {{answer}}. Relancer la commande.',
  candidateQuestion: 'Candidat',
  noCandidate: 'Aucun Candidat : en créer un dans la page Candidats du front.',
  postingQuestion: 'Offre à modifier',
  noPosting: 'Aucune Offre pour {{candidateName}} : « jf detect » cherche les nouvelles Offres.',
  artifactQuestion: 'Artefact à modifier',
  chosenVersionLabel: '{{artifactLabel}} (v{{number}}, retenue)',
  noArtifact:
    "L'Offre {{reference}} n'a aucun Artefact à modifier : « jf run research {{reference}} » produit sa Recherche.",

  candidatesDescription: 'Liste les Candidats, que la page Candidats du front crée et renomme',
  listDescription: "Liste les Offres d'un Candidat : jf list <candidat>",
  listUsage: 'Usage : jf list <candidat>. « jf candidates » liste les Candidats.',

  detectDescription:
    'Cherche les nouvelles Offres de chaque Veille ; --automation marque celle du jour : jf detect [--automation]',
  detectionSummary: 'Veille {{watchId}} ({{candidateId}}) : {{newPostings}}{{firstLaunch}}\n',
  noNewPosting: 'aucune nouvelle Offre',
  newPostings: '{{newCount}} nouvelles Offres',
  firstLaunch: ', premier lancement : importées sans rien déclencher',
  nearMissHeading: 'Titres écartés de justesse :\n',

  importDescription:
    "Importe une Fiche de poste en Markdown trouvée ailleurs : le worker en relève les champs avec Claude Code, puis met sa Recherche en file ; Candidat proposé si absent, --wait attend l'extraction : jf import <fichier> [<candidat>] [--wait]",
  importUsage: 'Usage : jf import <fichier> [<candidat>] [--wait], par exemple jf import offre-greffier.md lea.',
  imported: 'Offre {{reference}} importée, extraction de ses champs en file (job {{jobId}}).\n',
  importQueued: 'Le worker la lance, puis met sa Recherche en file. « jf list {{candidateId}} » la montre.\n',
  extractionWaiting: 'Attente du worker (service lpm worker) : Claude Code relève les champs…\n',
  extractionFailed:
    "Extraction des champs de l'Offre {{reference}} en échec ({{errorCode}}) :\n{{log}}\nRelancer : jf run extraction {{reference}}",
  extracted: '{{postingLine}}\nSa Recherche est en file : « jf versions {{reference}} research » la suit.\n',

  runDescription:
    "Met en file une nouvelle Version d'un Artefact, que le worker produit avec Claude Code ; --wait attend la fin : jf run research|letter|brief|visualization <offre> [--wait]",
  runUsage: 'Usage : jf run <module> <offre> [--wait], par exemple jf run research 2026-2445600.',
  queued: "{{module}} de l'Offre {{reference}} en file (job {{jobId}}).\n",
  runQueued: 'Le worker la produira. « {{versionsCommand}} » suit ses Versions.\n',
  runWaiting: 'Attente du worker (service lpm worker) : Claude Code peut prendre plusieurs minutes…\n',
  runFailed: '{{name}} en échec ({{errorCode}}) :\n{{log}}\nRelancer : jf run {{module}} {{reference}}',
  runReady: '{{name}} prête et retenue. « {{versionsCommand}} » liste ses Versions.\n',

  recipientsDescription: 'Affiche à qui adresser la candidature, selon la Lettre retenue : jf recipients <offre>',
  recipientsUsage: 'Usage : jf recipients <offre>, par exemple jf recipients 2026-2445600.',
  fieldLabelBySource: { applicationEmail: 'mail de candidature', contact1: 'contact 1', contact2: 'contact 2' },
  recipient: 'Destinataire : {{address}}',
  noRecipientAddress: "aucune adresse dans l'Offre",
  ccList: 'Copie : {{addresses}}',
  noCc: 'aucune',
  salutation: "Formule d'appel : {{text}}",
  justification: 'Justification : {{text}}',

  versionsDescription: "Liste les Versions d'un Artefact : jf versions <offre> research",
  versionsUsage: 'Usage : jf versions <offre> <artifact>, par exemple jf versions 2026-2445600 research.',
  versionStateLabelByState: { running: 'en cours', ready: 'prête', failed: 'en échec' },
  lastJobFailed: 'Dernier lancement en échec ({{errorCode}}) :\n{{log}}\n',
  lastJobStalled: "Dernier lancement à l'arrêt ({{errorCode}}) :\n{{message}}\n",
  chosenVersion: 'retenue',
  candidateInstructions: 'Consignes du Candidat',
  defaultInstructions: 'Consignes par défaut',
  createdAt: '{{createdAt, datetime(dateStyle: short; timeStyle: medium; timeZone: Europe/Paris)}}',
  chooseDescription: "Change la Version retenue d'un Artefact : jf choose <offre> research <version>",
  chooseUsage: 'Usage : jf choose <offre> <artifact> <version>, par exemple jf choose 2026-2445600 research 2.',
  versionChosen: "{{artifact}} {{version}} retenue pour l'Offre {{reference}}.\n",

  statusCommandDescription: '{{description}} : jf {{name}} <offre>',
  statusUsage: 'Usage : jf {{name}} <offre>. « jf list <candidat> » liste les Offres.',
  statusChanged: '{{reference}} : {{statusLabel}}\n',
  applyDescription: 'Passe une Offre en Postulée, avec ou sans Lettre, ce qui fige sa Lettre pour de bon',
  archiveDescription: 'Archive une Offre, quel que soit son Statut, qu’elle garde',
  unarchiveDescription: 'Désarchive une Offre, qui retrouve son Statut tel qu’il était',
  postingArchived: '{{reference}} : Archivée\n',
  postingUnarchived: '{{reference}} : plus Archivée\n',

  profileDescription: "Complète le Profil d'un Candidat avec Claude Code : jf profile <candidat>",
  profileUsage: 'Usage : jf profile <candidat>. « jf candidates » liste les Candidats.',
  editDescription:
    'Modifie un Artefact avec Claude Code, Offre et Artefact proposés si absents : jf edit [<offre> [<artifact>]]',

  instructionsDescription:
    "Montre, remplace (lues sur l'entrée standard) ou supprime les Consignes d'un module : jf instructions <candidat> [<module> [default|replace|delete]]",
  instructionsUsage: `${INSTRUCTIONS_USAGE} « jf candidates » liste les Candidats.`,
  unknownOperation: `Opération inconnue : {{operation}}. ${INSTRUCTIONS_USAGE}`,
  candidateInstructionsHeading: 'Consignes du Candidat de {{module}} :\n',
  defaultInstructionsHeading: 'Consignes par défaut de {{module}} :\n',
  typeInstructions: 'Tapez ou collez les Consignes, puis Ctrl-D :\n',
  instructionsReplaced: '{{module}} suivra ces Consignes du Candidat dans ses prochaines Versions.\n',
  instructionsDeleted: '{{module}} revient à ses Consignes par défaut.\n',

  workerReady: 'Worker prêt : il lance les jobs en file, un à la fois.\n',
  jobFailed: 'en échec : {{firstLine}}',
  conversionDone: 'rangée dans le Profil',
  conversionJob: 'job {{jobId}}, conversion de la Pièce {{upload}} de {{candidateId}} : {{outcome}}\n',
  artifactDone: 'prête et retenue',
  artifactJob: "job {{jobId}}, {{artifact}} de l'Offre {{reference}} : {{outcome}}\n",
  sessionGreeting: 'Bonjour !',
};
