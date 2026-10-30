# Les Candidats, leurs Veilles et le Délai par défaut vivent en base, et le front les écrit

Jusqu'ici, `data/config.json` était la source de vérité des Candidats, de leurs Veilles et du Délai par défaut : chaque lancement le recopiait en base. Ajouter une Veille ou un Candidat passait donc par Vincent et un fichier JSON. Désormais, la base est leur source de vérité et le front les écrit : un Candidat règle ses Veilles dans sa page Profil, et la page Candidats crée un Candidat, le renomme et règle le Délai par défaut. Le fichier n'est plus lu, sauf une fois : au premier lancement d'une base qui n'a pas encore son Délai par défaut, un `data/config.json` laissé là est importé, puis jamais relu.

Comme le reste du front (ADR-0002), ces écrans n'ont pas d'authentification : n'importe quel visiteur du front, sur le LAN ou le VPN, peut créer ou renommer un Candidat et régler le Délai par défaut. Les deux personnes qui y accèdent ont déjà la main sur tout le reste. En revanche, aucun Candidat ne se supprime : ni action, ni bouton. Ses Offres, ses Artefacts et ses Pièces n'ont pas de sens sans lui, et une suppression par erreur depuis un menu sans mot de passe serait irréparable.

## Considered Options

- **Garder `data/config.json` comme source de vérité, et le faire écrire par le front.** Rejeté : deux sources (le fichier et la base) à garder d'accord, et un fichier JSON que le front réécrit en entier pendant que `jf` ou le worker le lisent.
- **Réimporter le fichier à chaque lancement, en fusionnant avec la base.** Rejeté : chaque lancement écraserait ce que le front a enregistré, ou demanderait une règle de fusion champ par champ.
- **Renommer le fichier une fois importé.** Rejeté : l'application ne touche pas à un fichier que Vincent a écrit. La base retient elle-même que l'import a eu lieu (la ligne de son Délai par défaut existe), et `jf` signale à chaque commande que le fichier n'est plus lu, jusqu'à ce que Vincent le supprime.
- **Réserver la création d'un Candidat et le Délai par défaut à `jf`.** Rejeté : c'était justement ce qui faisait passer chaque changement par Vincent, et le front n'a de toute façon aucun moyen de distinguer ses visiteurs.
- **Archiver un Candidat, ou le supprimer avec ses Offres et ses Pièces.** Rejeté : aucun besoin aujourd'hui, et l'un comme l'autre demandent de décider ce que deviennent ses Offres. Un Candidat qui ne cherche plus garde ses données, sans Veille.

## Consequences

- Une base neuve démarre sans Candidat et avec un Délai par défaut de 6 mois. `jf`, le worker et le front démarrent sans `data/config.json`.
- L'import unique ne fait qu'ajouter ou mettre à jour : il ne supprime ni Candidat ni Veille, et garde le dernier passage de chaque Veille, pour que la Détection suivante ne reparte pas en premier lancement.
- Une Veille créée depuis le front est à son premier lancement : les Offres déjà en ligne qu'elle trouve sont importées sans rien déclencher (ADR-0003). Une Veille dont on change la Source ou les Paramètres y repart aussi : un titre élargi ne lance pas d'un coup une Recherche par Offre déjà en ligne.
- Une Veille supprimée garde ses Offres, qui appartiennent au Candidat et non à la Veille.
- Le Délai par défaut change le calcul d'Expirée dès son enregistrement dans le processus du front, et au lancement suivant dans les autres (`jf`, le worker).
- Un test d'architecture vérifie qu'aucun fichier de `src/` ne nomme plus `config.json`, sauf l'anti-corruption layer de l'import unique.
