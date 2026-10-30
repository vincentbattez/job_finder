# Archivée est une marque à part, indépendante du statut de l'Offre

Une Offre a d'un côté un statut, qui dit où en est sa Candidature (À traiter, Postulée, Obtenue, Refusée, et Convoquée ou Entretien passé selon ses Entretiens, ADR-0009), et de l'autre une marque Archivée, qui dit si le Candidat la suit encore. Archiver ne touche pas au statut : une Offre Convoquée qu'on archive reste Convoquée, et la désarchiver enlève seulement la marque. Avant, Archivée était une valeur de l'enum du statut, et on retrouvait l'étape à rétablir grâce à `postuleeAt`. Ça marchait avec deux étapes, mais plus avec cinq : il aurait fallu mémoriser à part une étape cachée.

## Considered Options

- **Garder Archivée dans l'enum et stocker l'étape d'avant l'archivage.** Rejeté : ça fait deux colonnes pour une seule information, et le statut d'une Offre Archivée ne dirait plus où en est sa Candidature.
- **Garder Archivée dans l'enum et toujours revenir à Postulée.** Rejeté : chaque désarchivage ferait perdre l'étape au Candidat, qui devrait la remettre à la main.

## Consequences

- La migration donne aux Offres déjà Archivées le statut Postulée si `postuleeAt` est renseigné, sinon À traiter, et leur pose la marque.
- Une Offre a une Candidature dès que son statut n'est plus À traiter. Comme une Candidature ne revient jamais À traiter, ce critère suffit même pour une Offre Archivée.
