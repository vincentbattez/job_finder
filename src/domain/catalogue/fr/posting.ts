import type { POSTING_EN } from '#/domain/catalogue/en/posting.ts';

export const POSTING_FR: typeof POSTING_EN = {
  pageTitle: '{{postingTitle}} · Job Finder',
  unreadPosting: 'Offre',
  stateLabelByState: {
    absent: 'Absent',
    in_progress: 'En cours',
    ready: 'Prêt',
    failed: 'En échec',
  },

  referenceTerm: 'Référence',
  publishedAtTerm: 'Publiée le',
  deadlineTerm: 'Date limite',
  repostOfTerm: 'Republication de',
  repostedAsTerm: 'Republiée en',
  artifactsHeading: 'Artefacts',
  contactsHeading: 'Contacts',
  contactLabelByField: {
    applicationEmail: 'Mail de candidature',
    contact1: 'Contact 1',
    contact2: 'Contact 2',
  },
  missingContact: 'Non précisé',
  recipientsHeading: 'Destinataires recommandés',
  noRecipients: 'La Lettre les recommande, une fois produite.',
  jobDescriptionHeading: 'Fiche de poste',
  readJobDescription: 'Lire la Fiche de poste',

  recipientTerm: 'Destinataire',
  noRecipientAddress: 'Aucune adresse dans l’Offre',
  ccTerm: 'Copie',
  noCc: 'Aucune',
  salutationTerm: 'Formule d’appel',

  statusButtonLabelByStatus: {
    to_apply: 'Remettre À traiter',
    applied: 'Marquer comme Postulée',
    archived: 'Archiver',
  },
  confirmApplied: 'Confirmer : Postulée',
  cancel: 'Annuler',
  appliedFreezesLetter: 'Une fois Postulée, la Lettre retenue ne change plus : c’est celle envoyée.',

  // Every Artifact is feminine in French: la Recherche, la Lettre, la Fiche d’entretien, la Visualisation
  launchArtifact: 'Lancer la {{artifactLabel}}',
  relaunchArtifact: 'Relancer la {{artifactLabel}}',
  extractionLabel: 'Champs relevés par Claude',
  relaunchExtraction: 'Relancer l’extraction',

  versionNumber: 'v{{versionNumber}}',
  noVersion: 'Aucune Version pour l’instant.',
  chosenBadge: 'Retenue',
  versionInstructions: 'Consignes de cette Version',
  noFile: 'Aucun fichier dans cette Version.',
  visualizationFrameTitle: 'Visualisation v{{versionNumber}}',
  chooseVersion: 'Retenir cette Version',

  documentLabel: 'Markdown',
  documentPlaceholder: '# Titre\n\nLe texte du document, en Markdown',
  save: 'Enregistrer',
  unsavedChanges: 'Modifications non enregistrées',
  preview: 'Aperçu',
  copy: 'Copier',
  copiedCommand: 'Copiée',
  copyMarkdown: 'Copier le Markdown',
  copiedMarkdown: 'Copié',

  runDetection: 'Lancer une Détection',
  detectionRunning: 'Détection en cours…',
  // French counts 0 as singular: zero has a sentence of its own
  detectionSummary_zero: 'Veille {{watchId}} : aucune nouvelle Offre',
  detectionSummary_one: 'Veille {{watchId}} : {{count}} nouvelle Offre',
  detectionSummary_other: 'Veille {{watchId}} : {{count}} nouvelles Offres',
  firstLaunchDetectionSummary_zero:
    'Veille {{watchId}} : aucune nouvelle Offre, premier lancement : importées sans rien déclencher',
  firstLaunchDetectionSummary_one:
    'Veille {{watchId}} : {{count}} nouvelle Offre, premier lancement : importées sans rien déclencher',
  firstLaunchDetectionSummary_other:
    'Veille {{watchId}} : {{count}} nouvelles Offres, premier lancement : importées sans rien déclencher',
  importIntro: 'Glissez ici une Fiche de poste en Markdown trouvée ailleurs : elle devient une de vos Offres.',
  importLabel: 'Importer une Fiche de poste',
  importedPosting: 'Offre importée :',
  importedPostingNext: 'Le worker en relève les champs avec Claude, puis lance sa Recherche.',
  filtersLabel: 'Filtres',
  cityFilter: 'Ville',
  regionFilter: 'Région',
  allChoices: 'Toutes',
  showArchived: 'Afficher les Archivées',
  filter: 'Filtrer',
  mapLabel: 'Carte des Offres',
  unlocatedPostings_one: '{{count}} Offre sans coordonnées n’est pas sur la carte.',
  unlocatedPostings_other: '{{count}} Offres sans coordonnées ne sont pas sur la carte.',
};
