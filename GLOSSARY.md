# Job Finder

Veille d'offres d'emploi et préparation des candidatures : repérer les offres qui correspondent à un candidat, puis produire pour chacune de quoi postuler et préparer l'entretien.

## Candidats

**Candidat**:
Personne qui cherche un emploi avec l'outil ; chaque Offre appartient à un seul Candidat.
_Avoid_: utilisateur, user, compte

**Profil**:
Ce que l'outil sait d'un Candidat pour écrire à sa place : son CV, les faits qu'il a validés et ses lettres passées.
_Avoid_: dossier, CV

**Veille**:
Recherche permanente d'un Candidat sur une Source, définie par ses critères et sa Zone.
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
Territoire d'une Veille où une Offre détectée lance automatiquement sa Recherche ; une Offre hors Zone est conservée mais pas traitée.
_Avoid_: région, périmètre

**Date limite**:
Dernier jour pour postuler à une Offre ; quand l'Offre n'en donne pas, sa date de publication plus un délai par défaut.
_Avoid_: date de fin, échéance

## Statut d'une Offre

**À traiter**:
Statut d'une Offre à laquelle le Candidat n'a pas encore postulé.
_Avoid_: nouvelle, en attente

**Postulée**:
Statut d'une Offre à laquelle le Candidat a envoyé sa candidature ; sa Lettre ne change plus.
_Avoid_: envoyée, candidatée, postulé

**Archivée**:
Statut d'une Offre que le Candidat a décidé de ne plus suivre.
_Avoid_: supprimée, ignorée

**Expirée**:
Se dit d'une Offre dont la Date limite est passée, quel que soit son statut.
_Avoid_: fermée, close, périmée

## Artefacts

**Artefact**:
Document produit pour une Offre et rattaché à elle : Recherche, Brouillon, Lettre, Fiche d'entretien, Visualisation.
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

**Fiche d'entretien**:
Artefact qui prépare l'entretien d'une Offre précise : ce qu'il faut réviser et comment s'entraîner.
_Avoid_: fiche de révision, fiche de compréhension, fiche mnémotechnique

**Visualisation**:
Mise en forme HTML d'une Fiche d'entretien, avec le même contenu.
_Avoid_: rendu, version HTML
