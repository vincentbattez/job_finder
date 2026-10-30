# Un module interchangeable ne se nomme que dans son dossier, le reste de l'application ne connaît que sa famille

Plusieurs modules font parfois le même travail, et le Candidat choisit lequel il utilise : chaque Canal de notification (Home Assistant aujourd'hui, e-mail ou Telegram demain), chaque Source qu'une Veille suit (la PEP aujourd'hui). Ce sont des modules interchangeables, regroupés en familles. Une famille a un contrat, dans `src/<famille>/` : ce que chaque module de la famille sait faire (envoyer une notification, détecter des Offres) et la façon dont il décrit ses Paramètres. Chaque module vit dans `src/modules/<famille>-<nom>/`, par exemple `src/modules/notification-home-assistant/`. Il exporte un descripteur qui suit ce contrat : son identifiant, son nom affiché, ses Paramètres (obligatoires, optionnels, secrets) décrits par un schéma Zod, et ses opérations.

Le reste de l'application ne connaît que la famille. La base a une table par famille, qui garde l'identifiant du module choisi et ses Paramètres en Json, parsés par le schéma du module. Le domaine, les actions et le front manipulent la famille, et le formulaire du front se construit à partir du descripteur. Le nom d'un module (`home-assistant`, `HomeAssistant`, `Home Assistant`) n'apparaît que dans son dossier et dans le registre `src/actions/modules.ts`, le seul fichier qui importe les modules d'une famille. Un test d'architecture le vérifie, car une règle seulement écrite finit contournée par oubli. Ajouter un module revient à créer un dossier et à ajouter une ligne au registre, sans migration, sans nouvel écran et sans nouvelle action.

C'est ce qu'ADR-0003 voulait dire par « les canaux de Notification sont interchangeables » : on change ou on ajoute un module sans toucher au reste.

## Considered Options

- **Une table, un type domaine, des actions et un composant du front pour chaque module** (`ConnexionHomeAssistant`, `saveConnexionHomeAssistant`, `connexion-home-assistant.tsx`). C'est ce que #30 a livré. Rejeté : un deuxième Canal demanderait une migration, un nouveau type, de nouvelles actions et un nouvel écran. Le nom Home Assistant s'est retrouvé dans 14 fichiers hors de son module.
- **Une colonne par Paramètre dans une table commune** (`url`, `token`, `service`, `email`…). Rejeté : chaque module ajouterait ses colonnes, et la plupart resteraient vides pour les autres.
- **Des Paramètres en Json sans schéma.** Rejeté : SQLite ne vérifie pas le Json (ADR-0004, ADR-0005). Seul le module connaît ses Paramètres, c'est donc son schéma qui les parse.
- **Le registre dans le dossier de la famille.** Rejeté : un module de `src/modules/` n'en importe aucun autre (ADR-0003). Le registre vit dans les actions, qui composent déjà les modules.

## Consequences

- Un Paramètre secret, comme le jeton d'un Home Assistant, est en écriture seule pour tous les modules, sur le modèle d'ADR-0006 : aucune action ne le renvoie et `test/write-only-token.test.ts` le vérifie. Le descripteur le marque comme secret, et le front affiche « configuré ✓ ».
- Ce qu'un module propose en plus (tester la connexion, lister les services de notification de son Home Assistant) passe par des actions génériques de la famille, comme tester le Canal ou lister les choix d'un Paramètre. Le descripteur déclare ce que le module propose.
- Les messages à l'utilisateur qui citent le module (« Home Assistant ne répond pas ») viennent du module lui-même.
- Le principe « le moins de code » tient toujours : une famille garde un seul module tant qu'on n'en demande pas un deuxième. C'est le contrat qui doit être générique, pas le nombre d'implémentations.
- Le module `source-import` n'est pas une Source qu'une Veille choisit : c'est l'import à la main d'une Fiche de poste. Il reste un module ordinaire, hors de la famille.
