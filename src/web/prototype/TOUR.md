# Visite guidée du prototype V1

Prototype jetable (branche `prototype/v1-ux`), sur une copie des données de Léa, en lecture seule. Ouvre-le sur le LAN : <http://192.168.100.3:5182/prototype>. Tout ce que tu fais vit en mémoire dans l'onglet : **un rechargement efface tout**. Enchaîne donc le parcours en cliquant, sans recharger ; les liens ci-dessous servent à reprendre une étape ou une variante.

## Variantes

Une pastille noire en bas de l'écran (sous l'en-tête sur téléphone) change de variante ; ← → au clavier, Shift + ← → pour le panneau.

| Zone                            | Paramètre   | A               | B                          | C                   |
| ------------------------------- | ----------- | --------------- | -------------------------- | ------------------- |
| Listes + carte                  | `?variant=` | Tableau + carte | Carte d'abord              | Par échéance        |
| Lecture d'un Artifact, Révision | `?variant=` | Colonne         | **Rail et marge (défaut)** | Étude               |
| Panneau de génération           | `?panel=`   | Dialog          | Sheet + aperçu du Prompt   | **Étapes (défaut)** |

En gras, la variante retenue le 2 novembre 2026 : elle s'affiche sans paramètre ; les autres restent accessibles par la pastille ou l'URL.

Exemples : <http://192.168.100.3:5182/prototype/new?variant=B>, <http://192.168.100.3:5182/prototype/postings/2026-2417004?tab=research&variant=C&panel=B>.

## Le parcours

1. **Nouvelles** : <http://192.168.100.3:5182/prototype/new>. Clique une ligne : la Sheet s'ouvre (Notes modifiables en place). **Garder** : l'Offre quitte la liste et sa Recherche se lance (simulée, ~9 s).
2. **Détection** : « Lancer une Détection » sur Nouvelles ; la progression s'affiche par Veille, puis deux Republications arrivent en tête (« Juste trouvée »), la Sheet dit « Tu as postulé le … ».
3. **À traiter** : <http://192.168.100.3:5182/prototype/to-apply>. L'Offre gardée y est, avec ses pastilles R · L. Sheet → « Ouvrir la page complète ».
4. **Recherche** (onglet) : « Regénérer » ouvre le panneau → « Lancer » → « Voir le Brouillon » → « Valider la Version ». Le point de l'onglet passe au vert, la liste et la Sheet suivent.
5. **Lettre de motivation** : « Générer » (débloqué dès qu'une Recherche est validée) → « Lancer » → « Valider » → « Comparer à l'Original ».
6. **Marquer Postulée** (en-tête). Sans Lettre de motivation validée, une AlertDialog propose « Valider la Lettre de motivation et marquer Postulée » ou « sans Lettre de motivation » : essaie-la sur une Offre d'À traiter dont la pastille L est orange. Une fois Postulée, la Lettre de motivation est figée.
7. **Candidatures** : <http://192.168.100.3:5182/prototype/applications>. Ouvre l'Offre → « Ajouter un Entretien » (Dialog) → onglet **Entretiens** : Fiche d'entretien | Portrait → « Réviser l'Entretien » → flèche retour.
8. **Notes** : modifie-les dans la Sheet ou dans l'onglet Notes, l'autre suit.
9. **Changer de Candidat** (en tête de la barre latérale) : la page reste la même ; depuis une page d'Offre, retour à Nouvelles.
10. **Téléphone** : Nouvelles en 390 px, la carte en surface, la liste dans un tiroir à tirer vers le haut.

## L'exemple MDX (Béziers)

L'Offre de Béziers porte une Recherche et une Fiche d'entretien réécrites à la main en MDX, en Brouillon, pour montrer le rendu visé :

- Recherche : <http://192.168.100.3:5182/prototype/postings/2026-2417004?tab=research>
- Fiche d'entretien : <http://192.168.100.3:5182/prototype/postings/2026-2417004?tab=interviews&interview=1>
- Révision : <http://192.168.100.3:5182/prototype/postings/2026-2417004/interviews/1/revision> (essaie `?variant=B` et `?variant=C`)
- Panneau seul, sans la page : <http://192.168.100.3:5182/prototype/generation-demo/2026-2417004?artifact=letter&panel=B>

## Ce qui est simulé

- Aucune session Claude : une génération attend quelques secondes puis écrit une Version de démonstration (la précédente sous une note « Version simulée »).
- La Détection n'interroge aucun site : elle fabrique deux Republications d'Offres existantes. L'Import n'enregistre rien.
- Aucune notification, aucune écriture en base ni dans `data/` ; un rechargement repart de la copie.
- Le snapshot n'a presque rien « À traiter » : au démarrage, six Nouvelles sont gardées d'office avec des états variés (choisies par date limite du jour, elles changent avec les jours).
- Profil, Veilles et Réglages sont des pages d'attente ; « Ajouter la mienne » simule la conversion d’un PDF.
