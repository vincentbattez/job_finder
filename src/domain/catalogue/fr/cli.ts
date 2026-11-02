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
  fileWriteFailed:
    'Impossible d’écrire le fichier {{filePath}} ({{reason}}). Vérifier que son dossier est accessible en écriture.',

  deadline: '{{deadline, datetime(timeZone: UTC)}}',
  startDate: 'Prise de poste le {{startDate, datetime(timeZone: UTC)}}',
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
  chosenInterviewVersionLabel: "{{artifactLabel}} de l'Entretien {{interviewNumber}} (v{{number}}, retenue)",
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
    "Met en file une nouvelle Version d'un Artefact, que le worker produit avec Claude Code ; --wait attend la fin : jf run research|letter|portrait|brief|visualization <offre> [<entretien>] [--wait]",
  runUsage:
    "Usage : jf run <module> <offre> [<entretien>] [--wait], par exemple jf run research 2026-2445600, ou jf run brief 2026-2445600 1 pour la Fiche d'entretien de l'Entretien 1.",
  queued: "{{module}} de l'Offre {{reference}} en file (job {{jobId}}).\n",
  runQueued: 'Le worker la produira. « {{versionsCommand}} » suit ses Versions.\n',
  runWaiting: 'Attente du worker (service lpm worker) : Claude Code peut prendre plusieurs minutes…\n',
  runFailed: '{{name}} en échec ({{errorCode}}) :\n{{log}}\nRelancer : {{command}}',
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

  versionsDescription:
    "Liste les Versions d'un Artefact : jf versions <offre> research, ou jf versions <offre> brief <entretien> pour un Artefact d'un Entretien",
  versionsUsage:
    'Usage : jf versions <offre> <artifact> [<entretien>], par exemple jf versions 2026-2445600 research, ou jf versions 2026-2445600 brief 1.',
  versionStateLabelByState: { running: 'en cours', ready: 'prête', failed: 'en échec' },
  lastJobFailed: 'Dernier lancement en échec ({{errorCode}}) :\n{{log}}\n',
  lastJobStalled: "Dernier lancement à l'arrêt ({{errorCode}}) :\n{{message}}\n",
  chosenVersion: 'retenue',
  candidateInstructions: 'Consignes du Candidat',
  defaultInstructions: 'Consignes par défaut',
  createdAt: '{{createdAt, datetime(dateStyle: short; timeStyle: medium; timeZone: Europe/Paris)}}',
  chooseDescription:
    "Change la Version retenue d'un Artefact : jf choose <offre> research <version>, ou jf choose <offre> brief <version> <entretien>",
  chooseUsage:
    'Usage : jf choose <offre> <artifact> <version> [<entretien>], par exemple jf choose 2026-2445600 research 2, ou jf choose 2026-2445600 brief 2 1.',
  versionChosen: "{{artifact}} {{version}} retenue pour l'Offre {{reference}}.\n",

  statusCommandDescription: '{{description}} : jf {{name}} <offre>',
  statusUsage: 'Usage : jf {{name}} <offre>. « jf list <candidat> » liste les Offres.',
  statusChanged: '{{reference}} : {{statusLabel}}\n',
  applyDescription: 'Passe une Offre en Postulée, avec ou sans Lettre, ce qui fige sa Lettre',
  toApplyDescription:
    'Remet À traiter une Offre Postulée sans Entretien dont la Lettre n’a jamais été envoyée, sa Lettre de nouveau libre',
  hiredDescription: 'Marque une Candidature comme Poste obtenu : le Candidat a le poste',
  rejectedDescription: "Marque une Candidature Refusée : l'employeur n'a pas retenu le Candidat",
  inProgressDescription: 'Remet En cours, soit Postulée, une Candidature qui a son issue, Poste obtenu ou Refusée',
  archiveDescription: 'Archive une Offre, quel que soit son Statut, qu’elle garde',
  unarchiveDescription: 'Désarchive une Offre, qui retrouve son Statut tel qu’il était',
  postingArchived: '{{reference}} : Archivée\n',
  postingUnarchived: '{{reference}} : plus Archivée\n',

  profileDescription: "Complète le Profil d'un Candidat avec Claude Code : jf profile <candidat>",
  profileUsage: 'Usage : jf profile <candidat>. « jf candidates » liste les Candidats.',
  editDescription:
    'Modifie un Artefact avec Claude Code, Offre et Artefact proposés si absents : jf edit [<offre> [<artifact> [<entretien>]]]',

  instructionsDescription:
    "Montre, remplace (lues sur l'entrée standard) ou supprime les Consignes d'un module : jf instructions <candidat> [<module> [default|replace|delete]]",
  instructionsUsage: `${INSTRUCTIONS_USAGE} « jf candidates » liste les Candidats.`,
  unknownOperation: `Opération inconnue : {{operation}}. ${INSTRUCTIONS_USAGE}`,
  candidateInstructionsHeading: 'Consignes du Candidat de {{module}} :\n',
  defaultInstructionsHeading: 'Consignes par défaut de {{module}} :\n',
  typeInstructions: 'Tapez ou collez les Consignes, puis Ctrl-D :\n',
  instructionsReplaced: '{{module}} suivra ces Consignes du Candidat dans ses prochaines Versions.\n',
  instructionsDeleted: '{{module}} revient à ses Consignes par défaut.\n',

  notesDescription:
    "Montre ou remplace (lues sur l'entrée standard) les Notes d'une Offre, quel que soit son Statut : jf notes <offre> [replace]",
  notesUsage: 'Usage : jf notes <offre> [replace]. « jf list <candidat> » liste les Offres.',
  typeNotes: 'Tapez ou collez les Notes en Markdown, puis Ctrl-D :\n',
  notesReplaced: 'Notes de {{reference}} enregistrées.\n',
  interviewsDescription:
    "Liste les Entretiens d'une Candidature par date, ou en ajoute, modifie ou supprime un, le début à l'heure de Paris : jf interviews <offre> [add | edit <numéro> | delete <numéro>] [--start 2026-11-19T14:00] [--duration <minutes>] [--place <lieu>] [--interviewers <texte>]",
  interviewsUsage:
    'Usage : jf interviews <offre> [add --start 2026-11-19T14:00 | edit <numéro> | delete <numéro>] [--duration <minutes>] [--place <lieu>] [--interviewers <texte>]. « jf interviews <offre> » liste les numéros.',
  noInterview: 'Aucun Entretien pour {{reference}}.\n',
  interviewMinutes: '{{minutes}} min',
  interviewAdded: 'Entretien ajouté à {{reference}}.\n',
  interviewEdited: 'Entretien {{number}} de {{reference}} enregistré.\n',
  interviewDeleted: 'Entretien {{number}} de {{reference}} supprimé.\n',
  icalDescription:
    'Écrit le fichier iCal d’un Entretien dans le dossier courant, ses liens sur l’adresse du front : jf ical <offre> <entretien> [--origin http://mac-mini.local:5180]',
  icalUsage:
    'Usage : jf ical <offre> <entretien> [--origin <adresse du front>]. « jf interviews <offre> » liste les numéros.',
  icalWritten: 'Fichier iCal écrit : {{filePath}}\n',

  workerReady: 'Worker prêt : il lance les jobs en file, un à la fois.\n',
  jobFailed: 'en échec : {{firstLine}}',
  conversionDone: 'rangée dans le Profil',
  conversionJob: 'job {{jobId}}, conversion de la Pièce {{upload}} de {{candidateId}} : {{outcome}}\n',
  artifactDone: 'prête et retenue',
  artifactJob: "job {{jobId}}, {{artifact}} de l'Offre {{reference}} : {{outcome}}\n",
  sessionGreeting: 'Bonjour !',
};
