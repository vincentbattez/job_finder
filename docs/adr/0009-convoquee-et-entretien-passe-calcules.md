# Convoquée et Entretien passé se calculent depuis les Entretiens, ils ne sont jamais stockés

Le statut stocké d'une Offre est À traiter, Postulée, Obtenue ou Refusée. Une Candidature Postulée s'affiche Convoquée tant qu'un de ses Entretiens est à venir, et Entretien passé dès qu'ils ont tous eu lieu. On le calcule à chaque lecture, comme Expirée, puisque ça dépend de l'heure. Sans Entretien, elle reste Postulée. Une fois Obtenue ou Refusée, l'issue l'emporte sur les Entretiens. Le Candidat ne choisit donc jamais Convoquée : il ajoute un Entretien, et l'étape suit.

## Considered Options

- **Toutes les étapes stockées, choisies au sélecteur.** Rejeté : l'étape et les Entretiens se contrediraient, par exemple une Offre Convoquée sans Entretien, ou Entretien passé avec un Entretien la semaine prochaine.
- **Stockées, avec une règle « ajouter un Entretien passe l'Offre Convoquée ».** Rejeté : rien ne la ferait passer Entretien passé, il faudrait y penser à la main après chaque tour.
