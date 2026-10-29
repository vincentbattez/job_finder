# Modules indépendants, reliés par les Artefacts et une file de jobs

Chaque fonction est un module indépendant : chaque Source, la Détection, la Recherche, la Lettre, la Fiche d'entretien, la Visualisation et la Notification. Un module a son propre dossier et un seul point d'entrée, et ses prompts sont dans des fichiers à part. Les modules ne s'appellent jamais entre eux. Ils lisent la Fiche de poste et les Artefacts sur disque, puis écrivent leur propre Artefact. Le front, la CLI et la Détection ne lancent aucun module directement : ils ajoutent un job dans une file SQLite. Un worker séparé, déclaré comme service lpm, vide cette file en lançant une seule session `claude -p` à la fois, ce qui permet de rester dans l'abonnement Claude Code. Seule la Détection tourne selon un horaire, via une automation lpm quotidienne. Le reste est déclenché par un humain, sauf la Recherche d'une nouvelle Offre dans la Zone, qui démarre automatiquement.

On veut pouvoir modifier ou lancer un module seul sans toucher au reste. Avec un worker séparé du front, redémarrer le front pendant le développement ne coupe pas une session en cours, et le nombre de sessions Claude simultanées reste borné.

## Considered Options

- **Le front lance `claude -p` lui-même.** C'est moins de code, mais un redémarrage du front coupe les sessions en cours, et deux clics lancent deux sessions en parallèle.
- **Une automation lpm par étape, qui interroge la base à intervalle régulier.** Rejeté : à part la Détection, les étapes doivent être lancées par le Candidat, pas selon un horaire.
- **LangGraph (ou un autre framework d'orchestration de LLM).** Rejeté :
  - Ses nœuds appellent le modèle avec une clé API (`ChatAnthropic`), donc hors de l'abonnement Claude Code.
  - Il faudrait recoder les outils que Claude Code fournit déjà : recherche web, lecture et écriture de fichiers, skills.
  - Chaque module ne fait qu'une session indépendante, sans graphe à orchestrer en mémoire. La file SQLite et les Artefacts couvrent déjà la persistance.

## Consequences

- Le front et la CLI sont deux façons d'appeler les mêmes actions. Aucune règle métier ne vit dans l'un ou l'autre, pour qu'il n'y ait qu'une seule source de vérité par fonctionnalité. Tout le parcours principal peut donc se faire en CLI.
- Le prompt d'un module a deux parties :
  - Une partie fixe, inscrite dans le code : ce que le module lit, le format et l'emplacement de ce qu'il produit, et les règles non négociables (ne jamais inventer un fait, ne jamais toucher au statut d'une Offre).
  - Ses Consignes : un Candidat peut les remplacer entièrement, mais il ne peut pas toucher à la partie fixe, si bien qu'une surcharge maladroite ne casse pas le module. Chaque Version garde la trace des Consignes qui l'ont produite.
- Les canaux de Notification sont interchangeables (Home Assistant, e-mail, Telegram…) et chaque Candidat choisit le sien. La v0 n'implémente que Home Assistant.
