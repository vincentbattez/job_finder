# Détecter les offres d'attaché de justice via le flux DSJ national et une regex sur le titre

Place de l'Emploi Public n'a aucun flux dédié aux attachés de justice. On lit le flux RSS de l'entité Direction des Services Judiciaires (`offerRss.ashx?LCID=1036&Rss_Entity=1123&top=1000`). Ce flux contient toutes les offres d'attaché de justice, qu'on reconnaît par une regex sur le titre et une liste d'exclusion. La Zone s'exprime en ressorts de cour d'appel : les Hauts-de-France correspondent exactement aux ressorts de Douai (entité 1779) et d'Amiens (entité 1798). On la lit dans la cour d'appel employeuse de l'offre, jamais dans le département qu'elle affiche.

## Considered Options

Mesures du 2026-10-29, sur 82 offres d'attaché de justice en ligne :

- **Flux de recherche par mot-clé du site.** Il rate 5 offres sur 82 (des titres en « (e) ») et remonte 11 faux positifs (chef de cabinet, assistant spécialisé…). Une parenthèse dans le mot-clé provoque une HTTP 500.
- **Filtre Domaine/Métier « Juriste spécialisé en juridiction ».** Il rate 22 offres sur 82, que leur recruteur a classées sous d'autres métiers.
- **Zone par département.** Le département affiché est parfois faux : des offres du TJ de Boulogne-sur-Mer sont classées « Nord (59) ».

## Consequences

- Sans `top`, le flux s'arrête aux 20 offres les plus récentes. Le paramètre est donc obligatoire.
- Le site ignore sans prévenir un identifiant de filtre inconnu et renvoie alors toutes les offres. La Détection vérifie que le titre du channel RSS reprend bien le filtre demandé, et échoue sinon.
- Les offres restent dans le flux après leur Date limite, et leur `pubDate` peut changer. On déduplique sur la référence (`AAAA-NNNNNNN`), jamais sur la date.
- Le flux ne contient ni Date limite, ni contacts, ni lieu d'affectation : ces informations viennent de la fiche détaillée, sauvegardée dès la Détection.
