// PROTOTYPE · Posting page agent. The Béziers Research rewritten in MDX with the closed catalogue, from
// its Markdown Version 1: appended by showcase.server.ts as a Draft produced by the AI, so the Research
// tab shows the target rendering too. Its sources keep their links.

export const RESEARCH_SHOWCASE = `# Recherche : attaché(e) de justice au siège, TJ de Béziers

_Recherche arrêtée au 31 octobre 2026 · réf. 2026-2417004_

<Callout type="info" title="En une phrase">

Béziers cherche quelqu’un qui **produit des projets de décisions en volume**, au civil comme au pénal, et qui accepte d’être **réaffecté d’un service à l’autre**. Il ne s’agit pas de redresser un tribunal en crise, mais de **tenir des délais déjà maîtrisés** face à une activité pénale en forte hausse.

</Callout>

## Synthèse

Une bonne candidature montrera trois choses, preuves à l’appui.

<Cards>

<Card title="Les deux matières" description="Civil et pénal, sans hiérarchie">

Un niveau « excellent ou très bon » dans les deux, et un exemple concret dans chacune.

</Card>

<Card title="Une méthode de rédaction" description="Rapide et fiable">

Les attachés et assistants ont rédigé **plus de 3 000 projets** en 2025 ([Hérault Tribune, 30/01/2026](https://echo-des-tribunes.com/herault-tribune/articles/1-044-annees-de-prison-et-2-millions-deuros-confisques-le-bilan-du-tribunaljudiciairede-beziers)).

</Card>

<Card title="La déontologie" description="Serment, secret, délibéré">

Assister au délibéré sans y prendre part : l’attaché prépare, le juge décide.

</Card>

<Card title="Un projet à trois ans" description="Si c’est le vôtre">

La durée du contrat correspond à la condition d’accès au concours professionnel de l’ENM.

</Card>

</Cards>

## Ce que dit l’offre

<Tabs>

<Tab title="Le poste">

- CDD de 3 ans, catégorie A, **29 000 € brut par an**, prise de poste le **1er décembre 2026**.
- **Mission principale : « rédiger des projets de décisions »**, jugements ou ordonnances ; plus ponctuellement des notes de synthèse et des recherches.
- Affectation « totalement ou partiellement » à l’un de six services, « susceptible d’évoluer en fonction des besoins de la juridiction ».
- La personne relève de la présidente et du magistrat délégué auprès duquel elle travaille.

</Tab>

<Tab title="Points à signaler">

<Accordion>

<AccordionItem title="La date limite est passée">

Elle était au 22/10/2026 ; un entretien est prévu le 2 novembre avec la présidente. Cette recherche sert surtout à le préparer.

</AccordionItem>

<AccordionItem title="Le télétravail est contradictoire">

« NON » dans les conditions d’exercice, « Oui » dans les informations complémentaires. À clarifier en entretien.

</AccordionItem>

<AccordionItem title="Le renouvellement n’est pas établi">

L’offre ne parle que d’un CDD de 3 ans ; les articles R. 123-30 et suivants du COJ n’ont pas pu être lus.

</AccordionItem>

</Accordion>

</Tab>

</Tabs>

## Le cadre juridique du métier

- **Article L. 123-4 du COJ** (depuis le 1er novembre 2024) : les attachés assistent les magistrats « dans l’aide à la décision », sous leur responsabilité, sans délégation de signature ; ils prêtent serment et sont tenus au secret.
- **Origine** : la LOPJ 2023-2027, « dans l’objectif de professionnaliser les équipes autour des magistrats ».
- **Débouché** : le concours professionnel de l’ENM, ouvert aux attachés justifiant de trois années d’exercice.

<Quote author="Conseil constitutionnel" source="décision n° 2023-855 DC du 16 novembre 2023, § 113">

Les attachés de justice, tenus au secret, peuvent seulement assister au délibéré, ce qui exclut qu’ils puissent y prendre part.

</Quote>

## Le TJ de Béziers en chiffres

<Table caption="Bilan 2025, audience solennelle du 29 janvier 2026">

| Repère | 2025 |
| --- | --- |
| Ressort | Plus de 150 communes, 323 000 habitants, forte hausse l’été |
| Effectifs | 25 magistrats du siège, 9 au parquet, 92 greffiers et fonctionnaires |
| Civil | 7 400 jugements et ordonnances ; fixation entre 1 et 4 mois |
| JAF | 2,5 mois au plus entre la saisine et l’examen |
| Pénal | Jugement en 3 mois ; comparutions immédiates +26 % ; gardes à vue +11 % |
| Fragilité | Postes vacants « pas résolus » |

</Table>

<Diagram title="Le départage prud’homal, résorbé en deux ans" caption="Stock au 1er janvier, puis au 18 janvier 2024 (bilan 2023)">

~~~mermaid
xychart-beta
  x-axis ["2022", "2023", "2024"]
  y-axis "Dossiers" 0 --> 200
  bar [185, 92, 0]
~~~

</Diagram>

<Callout type="tip" title="Ce que cela suggère (déduction)">

Les stocks civils historiques semblent résorbés. L’enjeu serait surtout de **maintenir ces délais** malgré la hausse pénale, et d’**améliorer la motivation** des décisions.

</Callout>

## La nouvelle présidente

<Timeline>

<Event date="19 août 2026" title="Nommée par décret">

Céline Chéron quitte la présidence du TJ de Tarascon ([Légifrance, JORF du 21/08/2026](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054729176)).

</Event>

<Event date="17 sept. 2026" title="Installée à Béziers">

Première femme à présider la juridiction. « Le changement de président n’est pas une rupture, mais une continuité. »

</Event>

<Event date="22 sept. 2026" title="L’offre est diffusée">

Cinq jours après son installation : elle a probablement validé ce recrutement.

</Event>

</Timeline>

Ses priorités : <Badge>délais</Badge> <Badge>qualité des décisions</Badge> <Badge>compréhension des jugements</Badge> <Badge>victimes</Badge> <Badge>IA et déontologie</Badge>

## Ce que je n’ai pas pu établir

<Checklist title="À vérifier en entretien">

- Le nombre d’attachés en poste à Béziers, et la raison de la vacance.
- Le service d’affectation en premier, et les stocks par service en 2026.
- Le renouvellement du contrat et la formation à l’ENM.
- Le télétravail.

</Checklist>
`;
