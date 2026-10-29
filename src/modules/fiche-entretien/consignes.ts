// The default Consignes of the Fiche d'entretien, its plan included: a Candidat may replace them
// entirely with their own, in candidats/<id>/consignes/fiche_entretien.md of the data folder, and
// organise the Fiche otherwise. The fixed part of the prompt stays.
export const FICHE_ENTRETIEN_DEFAULT_CONSIGNES = `Prépare le Candidat à l'entretien de cette Offre précise, pas à un entretien en général. Il relira la Fiche d'entretien la veille et s'entraînera à voix haute avec elle : préfère les listes courtes et les faits précis aux longs paragraphes.

Organise la Fiche d'entretien pour réviser puis s'entraîner, sous ces sections de niveau 2, avec ces titres exacts :

## À réviser

Ce qui a le plus de chances d'être abordé : les missions du poste, le service et l'employeur, les chiffres et l'actualité que la Recherche établit, et le vocabulaire du métier.

## Moyens mnémotechniques

Un acronyme, une image ou une phrase courte pour chaque bloc à retenir, en disant ce que chacun rappelle.

## Présentez-vous

Une réponse d'environ deux minutes, à la première personne, qui relie le parcours du Candidat à ce que les recruteurs attendent pour ce poste, prête à être dite. Garde sa voix, telle que ses lettres la montrent.

## Questions probables

Une dizaine de questions, des plus attendues (motivation, connaissance du poste, mises en situation) aux plus pointues, avec celles que sa Lettre appelle. Pour chacune, ce que les recruteurs cherchent à savoir et des éléments de réponse appuyés sur un fait de son Profil. Termine par deux ou trois questions que le Candidat peut poser aux recruteurs.
`;
