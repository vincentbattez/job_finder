# Job Finder

Veille d'offres d'emploi et préparation des candidatures : repérer les offres qui correspondent à un candidat, puis produire pour chacune de quoi postuler et préparer l'entretien.

## Candidats

**Candidat**:
Personne qui cherche un emploi avec l'outil ; chaque Offre appartient à un seul Candidat.
_Avoid_: utilisateur, user, compte

**Profil**:
Ce que l'outil sait d'un Candidat pour écrire à sa place : son CV, les faits qu'il a validés et ses lettres passées.
_Avoid_: dossier, CV

**Faits**:
Partie du Profil qui recense, par rubrique, ce que le Candidat a validé sur lui-même : identité, coordonnées, diplômes, expériences, compétences, motivations, mobilité.
_Avoid_: renseignements, informations, fiche

**Pièce**:
Document d'origine, comme un CV ou une lettre passée en PDF, que le Candidat dépose dans son Profil ; il est gardé tel quel, et le Profil en contient la conversion en Markdown.
_Avoid_: upload, pièce jointe, fichier source

**Canal de notification**:
Moyen par lequel l'outil prévient un Candidat, comme son Home Assistant qui envoie la notification sur son téléphone ; chaque Candidat choisit le sien et en règle les Paramètres.
_Avoid_: Connexion Home Assistant, intégration, provider

**Paramètre**:
Valeur que demande un Canal de notification ou une Source pour fonctionner, comme l'adresse et le jeton d'un Home Assistant, ou le titre recherché et la Zone d'une Veille ; chacun déclare les siens, obligatoires ou optionnels, et un Paramètre secret ne se relit jamais.
_Avoid_: réglage, option, config

**Veille**:
Recherche permanente d'un Candidat sur une Source, définie par les Paramètres que demande cette Source, sa Zone comprise.
_Avoid_: alerte, abonnement, recherche sauvegardée

## Offres

**Offre**:
Annonce publiée par un employeur, identifiée par sa référence dans sa Source ; c'est l'unité que l'outil suit.
_Avoid_: poste, fiche de poste, annonce, job

**Fiche de poste**:
Contenu descriptif d'une Offre (missions, profil recherché, conditions, contacts), conservé tel que publié.
_Avoid_: description, offre

**Poste**:
L'emploi réel derrière une Offre ; un même Poste peut être publié en plusieurs Offres successives.
_Avoid_: offre

**Republication**:
Offre qui annonce à nouveau un Poste déjà publié sous une autre référence.
_Avoid_: doublon, mise à jour

**Source**:
Origine des Offres : un site d'emploi interrogé automatiquement, ou une Fiche de poste importée à la main.
_Avoid_: flux, provider, site

**Détection**:
Passage qui interroge la Source de chaque Veille et enregistre les Offres qu'on n'avait encore jamais vues.
_Avoid_: scan, crawl, alerte

**Zone**:
Territoire d'une Veille où une Offre détectée lance automatiquement sa Recherche ; chaque Source l'exprime à sa façon, et une Offre hors Zone est conservée mais pas traitée.
_Avoid_: périmètre, secteur

**Ville**:
Commune du lieu d'affectation d'une Offre, qui la place sur la carte.
_Avoid_: localité, lieu

**Région**:
Région administrative de la Ville d'une Offre, par laquelle le Candidat filtre ses Offres ; elle n'a rien à voir avec la Zone.
_Avoid_: zone, territoire

**Date limite**:
Dernier jour pour postuler à une Offre ; quand l'Offre n'en donne pas, sa date de publication plus un délai par défaut, une Fiche de poste importée étant publiée le jour de son import.
_Avoid_: date de fin, échéance

## Statut d'une Offre

**À traiter**:
Statut d'une Offre à laquelle le Candidat n'a pas encore postulé.
_Avoid_: nouvelle, en attente

**Postulée**:
Statut d'une Offre dont le Candidat a envoyé la candidature et qui attend son issue ; sa Candidature commence là, et sa Lettre ne change plus ensuite.
_Avoid_: envoyée, candidatée, postulé

**Candidature**:
Process de recrutement d'une Offre, de l'envoi de la candidature jusqu'à son issue ; une Offre a une Candidature dès qu'elle a été Postulée, même Archivée ensuite.
_Avoid_: process, suivi, offre en cours

**Convoquée**:
Se dit d'une Candidature sans issue qui a un Entretien à venir.
_Avoid_: entretien prévu, invitée

**Entretien**:
Rendez-vous que l'employeur fixe au Candidat pour une Candidature, avec son début, sa durée et son lieu ; une Candidature peut en compter plusieurs, un par tour.
_Avoid_: rendez-vous, convocation, tour

**Interlocuteurs**:
Personnes que le Candidat rencontre à un Entretien, décrites par lui en texte libre (nom, rôle, tout ce qu'il sait).
_Avoid_: jury, recruteurs, contacts

**Entretien passé**:
Se dit d'une Candidature sans issue dont tous les Entretiens ont eu lieu.
_Avoid_: en attente, résultat attendu

**Obtenue**:
Issue d'une Candidature où le Candidat a le poste.
_Avoid_: retenue, acceptée, embauché

**Refusée**:
Issue d'une Candidature où l'employeur n'a pas retenu le Candidat.
_Avoid_: rejetée, échec, non retenue

**Archivée**:
Se dit d'une Offre que le Candidat a décidé de ne plus suivre, quel que soit son statut, qu'elle garde ; la désarchiver la rend telle qu'elle était.
_Avoid_: supprimée, ignorée

**Expirée**:
Se dit d'une Offre dont la Date limite est passée, quel que soit son statut.
_Avoid_: fermée, close, périmée

**Notes**:
Texte libre que le Candidat tient sur une Offre, quel que soit son statut, et qu'il réécrit à volonté.
_Avoid_: journal, commentaires, suivi

## Artefacts

**Artefact**:
Document produit pour une Offre, ou pour l'un de ses Entretiens, et rattaché à lui : Recherche, Brouillon, Lettre, Portrait, Fiche d'entretien, Visualisation.
_Avoid_: livrable, output, fichier

**Version**:
Un exemplaire d'un Artefact, produit chaque fois qu'on relance sa génération ; une correction humaine modifie la Version sans en créer une nouvelle.
_Avoid_: révision, itération

**Version retenue**:
La Version d'un Artefact que le Candidat a choisie ; c'est sur elle que s'appuient les Artefacts suivants et, pour la Lettre, c'est elle qui est envoyée.
_Avoid_: version courante, version active, version sélectionnée

**Consignes**:
Instructions qui disent à l'IA comment produire un type d'Artefact ; chaque type a des Consignes par défaut, qu'un Candidat peut remplacer par les siennes.
_Avoid_: prompt, template, instructions

**Recherche**:
Artefact qui établit, sources à l'appui, ce que les recruteurs attendent pour une Offre et dans quel contexte (employeur, service, lieu).
_Avoid_: analyse, étude, dossier

**Brouillon**:
Lettre de motivation rédigée par l'IA pour une Offre ; il n'est plus jamais modifié ensuite.
_Avoid_: draft, première version

**Lettre**:
Lettre de motivation corrigée par l'humain à partir du Brouillon ; c'est elle qui est envoyée.
_Avoid_: lettre finale, LM

**Portrait**:
Artefact d'un Entretien qui établit, sources à l'appui, ce que l'on sait publiquement du parcours et des positions professionnelles de ses Interlocuteurs.
_Avoid_: recherche, profil, fiche

**Fiche d'entretien**:
Artefact qui prépare un Entretien précis en croisant l'Offre et ses Interlocuteurs : le discours à leur tenir, ce qu'il faut réviser et comment s'entraîner.
_Avoid_: fiche de révision, fiche de compréhension, fiche mnémotechnique

**Visualisation**:
Mise en forme HTML d'une Fiche d'entretien, avec le même contenu.
_Avoid_: rendu, version HTML
