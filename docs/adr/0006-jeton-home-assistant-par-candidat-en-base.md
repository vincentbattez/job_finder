# Le jeton Home Assistant de chaque Candidat est stocké en base, et ne repart jamais vers le front

> Remplacée en partie par ADR-0010 : la table propre à Home Assistant laisse sa place à celle de la famille des Canaux de notification. L'écriture seule tient toujours, et s'étend à tout Paramètre secret.

Chaque Candidat règle sa Connexion Home Assistant depuis sa page Profil : l'adresse de son Home Assistant, un jeton d'accès longue durée et le service de notification qui atteint son téléphone. Elles sont enregistrées dans la base SQLite de `data/`, dans une table à part, et plus dans `.env` ni dans `data/config.json`. C'est le premier secret que `data/` contient. Le front n'a aucune authentification (ADR-0002) : tout ce qu'une action lui renvoie, n'importe qui sur le LAN ou le VPN peut le lire. Le jeton est donc en écriture seule. Le front peut l'enregistrer ou le remplacer, mais aucune action ne le renvoie : la page affiche seulement « configuré ✓ ». Un test d'architecture le vérifie, une simple convention finirait contournée par oubli.

## Considered Options

- **Garder `HOME_ASSISTANT_URL` et `HOME_ASSISTANT_TOKEN` dans `.env`, communs à tous les Candidats.** Rejeté : un deuxième Candidat peut avoir son propre Home Assistant, et le réglage demandait de se connecter en SSH au Mac mini.
- **Mettre la connexion sur la ligne `Candidat` de la base.** Rejeté : ces lignes sont recopiées depuis `data/config.json` à chaque lancement et ne sont jamais modifiées ailleurs. Une table à part garde cette règle.
- **Laisser le service de notification dans `data/config.json`.** Rejeté : la page Profil le choisit dans la liste que renvoie le Home Assistant du Candidat, il doit donc s'écrire depuis le front.
- **Chiffrer le jeton dans la base.** Rejeté : la clé vivrait sur la même machine, dans `.env`. Ça ne protège que d'une fuite de la base seule, alors que la vraie surface d'exposition est le front, déjà fermée par l'écriture seule.
- **Renvoyer le jeton masqué (`abc…xyz`).** Rejeté : même un morceau de jeton n'a rien à faire dans le navigateur, et « configuré ✓ » suffit pour savoir où on en est.

## Consequences

- Une sauvegarde ou une copie de `data/` contient désormais un secret : elle se traite comme `.env`.
- Le test, le bouton « envoyer une notification de test » et la liste des services de notification passent par des actions côté serveur, qui lisent le jeton en base sans le renvoyer.
- Pendant la migration, un Candidat sans Connexion Home Assistant en base retombe sur `HOME_ASSISTANT_URL` et `HOME_ASSISTANT_TOKEN` de `.env`, et le service de `data/config.json` est recopié en base. Ce repli disparaît une fois la connexion de chaque Candidat enregistrée.
- Le jeton se lit en clair dans la base SQLite : quiconque a un accès shell au Mac mini le lit, comme il lisait `.env`.
