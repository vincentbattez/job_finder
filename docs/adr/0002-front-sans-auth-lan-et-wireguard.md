# Front sans authentification, joignable uniquement en LAN et via WireGuard

Le front n'a aucune authentification : on choisit le Candidat dans un menu, sans mot de passe. Ce choix ne tient que parce que le front n'est jamais exposé sur internet. Il écoute sur le réseau local du Mac mini, et l'accès à distance passe par le VPN WireGuard existant. L'exposer, même derrière un tunnel, donnerait à n'importe qui les données personnelles des Candidats et la possibilité de lancer des sessions Claude Code sur l'abonnement de Vincent.

## Considered Options

- **Un tunnel public protégé par un mot de passe partagé.** Rejeté : ça demande d'écrire et de maintenir du code d'authentification pour un projet personnel à deux utilisateurs, alors que les deux ont déjà accès au VPN.
