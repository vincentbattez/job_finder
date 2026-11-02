// PROTOTYPE · Posting page agent. The target rendering of ADR-0020 on real data: an Interview Brief
// hand-written in MDX with the closed catalogue (mdx-catalogue.tsx), for the Béziers Posting's first
// Interview, rewritten from its Markdown Version 2. The store (store.ts) seeds
// it as the newest Version, a Draft produced by the AI, whose Original differs from its text by a few
// corrections of the Candidate (so « Comparer à l'Original » has something to show). The store then
// overlays it like any other Version: validating, correcting or regenerating it works as usual.
import type { IInputRef } from '../model.ts';
import { RESEARCH_SHOWCASE } from './research-showcase.ts';

export const SHOWCASE_REFERENCE = '2026-2417004';
const SHOWCASE_ARTIFACT_KEY = 'interview_brief@1';
const SHOWCASE_CREATED_AT = '2026-11-02T08:12:00.000Z';

const SHOWCASE_INPUT_LIST: IInputRef[] = [
  { key: 'job_description', label: 'Fiche de poste' },
  { key: 'artifact:research', label: 'Recherche · v1' },
  { key: 'artifact:portrait@1', label: 'Portrait · Entretien 1 · v1' },
  { key: 'artifact:letter', label: 'Lettre · v1' },
  { key: 'profile:cv.md', label: 'CV' },
  { key: 'profile:facts.md', label: 'Faits' },
  { key: 'notes', label: 'Notes' },
];

// The Candidate's corrections: what the AI wrote, what the text says now
const CORRECTION_LIST: { original: string; corrected: string }[] = [
  {
    original:
      'Franchise sur les sessions : premier concours présenté en 2025 et en 2026, sans être admissible. [à compléter : écart exact à l’admissibilité en 2026]',
    corrected:
      'Franchise sur les sessions : premier concours présenté en 2025 et en 2026, sans être admissible, à 0,1 point de l’admissibilité en 2026. Dites le chiffre une fois, sans vous justifier.',
  },
  {
    original: '- Tester la connexion à 16 h 15.',
    corrected:
      '- Tester la connexion à 16 h 15, casque branché.\n- Poser un verre d’eau et le numéro du greffe à portée de main, au cas où la visio tombe.',
  },
  {
    original: 'Vous arrivez sans illusion.',
    corrected: 'Vous arrivez lucide, et motivée par ce rythme.',
  },
];

const BRIEF_TEMPLATE = `# Entretien 1 avec la présidente du TJ de Béziers

<Callout type="info" title="Lundi 2 novembre 2026 · 16 h 30 · visio · 30 minutes">

Face à vous : **Mme Céline Chéron, présidente du tribunal judiciaire de Béziers**, votre future supérieure hiérarchique directe. Elle décide de votre affectation et peut la faire évoluer.

</Callout>

## L’essentiel en une minute

<Cards>

<Card title="Qui elle est" description="Une magistrate de l’organisation des juridictions">

Administration centrale (2011-2015), secrétariat général du TGI de Bobigny (2015-2020), présidente du TJ de Tarascon (2020-2026). Installée à Béziers le **17 septembre 2026**, six semaines avant l’entretien.

</Card>

<Card title="Ce qu’elle regardera" description="En 30 minutes, pas votre spécialité">

Si vous êtes **vite productive**, **facile à affecter** d’un service à l’autre, **fiable** dans la rédaction et dans la déontologie.

</Card>

<Card title="Son vocabulaire" description="Reprenez ses mots">

<Badge>délais</Badge> <Badge>qualité des décisions</Badge> <Badge>justice lisible</Badge> <Badge>continuité</Badge> <Badge>polyvalence</Badge> <Badge>déontologie</Badge> <Badge>humanité</Badge>

</Card>

<Card title="Comment lui parler" description="Son langage d’ancienne secrétaire générale">

En **volumes**, en **délais** et en **méthode**. Jamais de critique du fonctionnement passé : elle se place dans la continuité de son prédécesseur.

</Card>

</Cards>

### Trois règles de langage pour tout l’entretien

<Steps>

<Step title="« Tribunal judiciaire »">

Jamais « tribunal de grande instance » pour une juridiction d’aujourd’hui.

</Step>

<Step title="« Propositions soumises à la validation du magistrat »">

Jamais « j’ai décidé ». L’attachée prépare, le magistrat décide.

</Step>

<Step title="Un seul magistrat nommé">

M. Michaël Bonnet, « premier vice-procureur près le tribunal judiciaire de Lille, ancien chef de la section économique, financière et environnementale ». Les autres : « un procureur », « un juge d’instruction », « un vice-président ».

</Step>

</Steps>

<Callout type="warning" title="Un point à anticiper sur votre lettre">

Elle dit « un stage » auprès de M. Bonnet et « la section des affaires économiques et financières ». Si la question vient, précisez sans vous troubler : **deux stages**, du 5 au 23 juin 2023 puis du 6 mai au 21 juin 2024, à la section économique, financière et environnementale. Le second est votre stage de fin de master 2, noté **17/20**.

</Callout>

## La juridiction en chiffres

<Table caption="Ce que disent l’offre et la presse locale (bilan 2025)">

| Repère | À retenir |
| --- | --- |
| Ressort | Ouest de l’Hérault, plus de 150 communes, 323 000 habitants ; forte hausse l’été (littoral) |
| Effectifs | 25 magistrats du siège, 9 au parquet, 92 greffiers et fonctionnaires de greffe |
| Renforts prévus | +5 magistrats, +2 greffiers, **+6 attachés de justice** (2023-2025) |
| Attachés et assistants | Plus de **3 000 projets de décisions** en 2025, dont près de 800 en affaires familiales |
| Civil | 8 magistrats rédacteurs, 7 400 jugements et ordonnances ; JAF : 2,5 mois entre saisine et examen (8 mois en 2022) |
| Pénal | Jugement en 3 mois environ ; comparutions immédiates +26 % ; une deuxième audience hebdomadaire depuis septembre 2025 |
| Prud’hommes | Stock du départage passé de 185 dossiers (2022) à zéro (janvier 2024) |
| Fragilité | Des postes vacants « non résolus » |

</Table>

<Callout type="tip" title="Ce que cela veut dire pour le poste">

Béziers n’est pas une juridiction à redresser : les stocks civils ont été résorbés entre 2022 et 2025. L’enjeu est de **tenir les délais** face à la hausse pénale et aux vacances de postes, et d’**améliorer la qualité de la motivation**. Sa formule d’installation : « Notre rôle est aussi de relier. »

</Callout>

<Diagram title="Votre place dans la juridiction" caption="L’attachée prépare, le magistrat délégué décide, la présidente affecte.">

~~~mermaid
flowchart TD
  P["Présidente · Mme Céline Chéron"] -->|affecte et fait évoluer| A["Vous · attachée de justice"]
  P --> S["Six services possibles"]
  S --> M["Magistrat délégué"]
  A -->|projets de décisions, notes, recherches| M
  M -->|valide, signe, décide| D["Décision"]
~~~

</Diagram>

## Le poste et son cadre

<Tabs>

<Tab title="L’offre mot pour mot">

- **Mission principale : « rédiger des projets de décisions »**, jugements ou ordonnances ; ponctuellement des notes de synthèse, des recherches juridiques.
- **Affectation « totalement ou partiellement »** à l’un de six services : présidence, pôle civil et JCP, pôle pénal, pôle social (départage), pôle famille (JAF), services spécialisés (enfants, application des peines, JLD).
- **Objectif affiché** : « constitution concrète d’une véritable équipe autour du magistrat », « apurement des stocks », « amélioration des délais ».
- **Savoir-être** : disponibilité, capacité à rendre compte, organisation, adaptabilité, réactivité, travail en équipe, discrétion.

</Tab>

<Tab title="Le cadre juridique">

- **Article L. 123-4 du code de l’organisation judiciaire** : les attachés assistent les magistrats « dans l’aide à la décision », sous leur responsabilité ; pas de délégation de signature ; prestation de serment ; secret professionnel (article 226-13 du code pénal).
- **Origine** : la LOPJ 2023-2027, pour « professionnaliser les équipes autour des magistrats » ; la fonction remplace celle de juriste assistant.
- **Débouché** : le concours professionnel de l’ENM est ouvert aux attachés justifiant de trois années d’exercice, la durée du contrat.

<Quote source="Conseil constitutionnel, décision n° 2023-855 DC, § 113">

Les attachés de justice peuvent seulement assister au délibéré, ce qui exclut qu’ils puissent y prendre part.

</Quote>

</Tab>

<Tab title="Les conditions">

CDD de 3 ans, catégorie A, 29 000 € brut par an, temps plein, prise de poste le **1er décembre 2026**, serment avant la prise de fonction.

<Callout type="note" title="Télétravail : l’offre se contredit">

« NON » dans les conditions d’exercice, « Oui » dans les informations complémentaires. Si vous posez la question, posez-la en dernier et sans insister.

</Callout>

</Tab>

</Tabs>

## L’actualité à connaître

<Timeline>

<Event date="10 sept. 2026" title="Le « choc numérique » du garde des Sceaux">

Procédure pénale numérique généralisée en décembre, minutier civil national, « Mon espace Justice », assistants d’IA pour 10 000 agents.

</Event>

<Event date="17 sept. 2026" title="Installation de la présidente">

Continuité ; réorganisation en urgence dès son premier jour après deux absences, d’où son appel à la **polyvalence** et à la **solidarité**. Priorités : délais, qualité et compréhension des décisions, victimes et personnes vulnérables.

</Event>

<Event date="Même audience" title="Trois magistrats installés avec elle">

Un vice-président JLD, une vice-présidente à l’application des peines, une juge : deux services spécialisés de l’offre viennent d’être renforcés.

</Event>

<Event date="Début décembre 2026" title="Mon espace Justice, et votre prise de poste">

Elle a dit le 1er décembre, le ministère le 9. **Ne donnez pas de date** : « au début du mois de décembre, au moment de ma prise de poste ».

</Event>

</Timeline>

## Révision technique par service

Elle peut tester une matière en deux questions. Pour chaque service : qui juge, quel texte, quelle forme de décision, quels délais.

<Tabs>

<Tab title="Civil · JCP">

Compétence du juge des contentieux de la protection : baux d’habitation, crédit à la consommation, **surendettement**, tutelles. Référés JCP (expulsions, impayés). Chambre du conseil pour les affaires non publiques. Vous avez étudié le surendettement (16/20).

</Tab>

<Tab title="Famille">

Divorce (requête unique depuis 2021), mesures (résidence, droit de visite, contribution, prestation compensatoire), **ordonnance de protection** (article 515-9 du code civil, six jours), liquidation des régimes matrimoniaux. 800 projets JAF rédigés par les attachés en 2025.

</Tab>

<Tab title="Social">

Le juge départiteur tranche en cas de partage des voix (article L. 1454-2 du code du travail) : licenciement, rappels de salaire, barème. Aucun enseignement de droit du travail dans votre Profil : dites-le franchement, et montrez comment vous l’apprendrez.

</Tab>

<Tab title="Pénal">

Motivation de la culpabilité et de la peine (articles 485 et 485-1 du CPP, 132-1 du code pénal), intérêts civils, **comparution immédiate** (articles 395 et suivants), CRPC, ordonnance pénale. Parlez des audiences de Lille en termes de rythme.

</Tab>

<Tab title="Spécialisés">

JLD : détention provisoire (articles 137 et suivants du CPP), rétention, soins sans consentement. Application des peines : aménagements (article 723-15 du CPP), libération conditionnelle. Enfants : code de la justice pénale des mineurs.

</Tab>

</Tabs>

### Dérouler un projet de jugement civil

<Steps>

<Step title="En-tête et composition">

La juridiction, la formation, les parties et leurs conseils.

</Step>

<Step title="Exposé du litige">

Les faits, la procédure, les prétentions et moyens des parties (article 455 du code de procédure civile).

</Step>

<Step title="Motifs">

Moyen par moyen, en répondant à chaque prétention, dans l’ordre où elle a été soulevée.

</Step>

<Step title="Dispositif">

Demandes principales, accessoires, dépens, article 700 ; exécution provisoire de droit depuis 2020.

</Step>

</Steps>

## Présentez-vous

<Callout type="info" title="Environ deux minutes, à voix haute, chronomètre en main">

Gardez le ton de vos lettres : sobre, précis, à la première personne.

</Callout>

<Quote author="Votre présentation" source="à dire, pas à lire">

« Madame la Présidente, je m’appelle Léa Meurillon. Je suis titulaire d’un master 2 en droit et contentieux privés, parcours magistrature, et j’ai consacré deux années, à temps plein, à la préparation du premier concours de l’ENM.

Mon expérience centrale, ce sont deux stages au parquet de Lille, à la section économique, financière et environnementale : des dossiers volumineux, des notes de synthèse, la méthode à charge et à décharge.

Pendant quatre ans, j’ai aussi tenu des permanences juridiques gratuites : j’y ai compris qu’une décision ne sert le justiciable que s’il la comprend.

Ce poste est généraliste, et ma formation l’est : civil et pénal. Je suis disponible dès maintenant et prête à m’installer à Béziers. »

</Quote>

<Callout type="warning" title="Si elle vous coupe avant la fin">

Gardez absolument trois éléments : les **deux stages au parquet de Lille** avec la méthode à charge et à décharge ; la **double formation civile et pénale** ; la **disponibilité immédiate** et l’installation à Béziers.

</Callout>

## Questions probables

Ouvrez une question, répondez à voix haute, puis comparez avec les éléments.

<Accordion>

<AccordionItem title="1. « Pourquoi le siège, alors que toute votre expérience est au parquet ? »">

**Ce qu’elle cherche.** Si votre candidature est un choix ou un repli.

- Franchise : votre axe est pénal, mais votre ouverture aux autres fonctions est réelle, et ce poste généraliste est fait pour l’exercer.
- La méthode est la même : dégager l’essentiel d’une procédure, identifier le point de droit, proposer sans décider.
- Ce qui vous attire : la motivation d’une décision qui doit tenir devant la cour d’appel (techniques d’appel et de cassation, 19/20).

</AccordionItem>

<AccordionItem title="2. « Vous serez affectée là où le besoin est le plus fort. Cela vous convient ? »">

**Ce qu’elle cherche.** Votre polyvalence réelle. C’est le cœur de son attente.

- Oui, sans réserve : vous avez postulé à un poste généraliste en connaissance de cause.
- Votre méthode d’entrée dans une matière nouvelle, tirée du stage de 2024 : définir chaque terme, interroger les juristes du service, partir des trames.
- Terminez sur son mot : la **polyvalence** qu’elle a demandée dès son premier jour.

</AccordionItem>

<AccordionItem title="3. « Plus de 3 000 projets en 2025. Quel rythme pouvez-vous tenir ? »">

**Ce qu’elle cherche.** Une méthode de production et un rapport honnête au volume.

- Fiche de synthèse du dossier, trame du service, rédaction, relecture ciblée sur le dispositif et les textes visés.
- Pour les séries : une trame par contentieux, enrichie dossier après dossier.
- Ne donnez pas de chiffre que vous n’avez pas : vous demanderez l’objectif du service et rendrez compte des écarts.

</AccordionItem>

<AccordionItem title="4. « Qu’est-ce qu’une bonne décision, pour vous ? »">

**Ce qu’elle cherche.** Sa priorité « qualité des décisions » et « justice lisible ».

- Votre phrase de la lettre : une décision « claire et rigoureusement motivée pour que le justiciable en comprenne la portée ».
- D’où elle vient : quatre ans de permanences au bus de l’accès au droit.
- Concrètement : répondre à chaque moyen, phrases courtes, dispositif sans ambiguïté.

</AccordionItem>

<AccordionItem title="5. « Quelle est votre place au délibéré ? Que vous impose le serment ? »">

**Ce qu’elle cherche.** La déontologie, qu’elle porte personnellement.

- La règle : article L. 123-4 du COJ, secret professionnel ; décision 2023-855 DC, § 113.
- La posture : vous préparez, le magistrat décide. Vous l’avez pratiqué au parquet.

</AccordionItem>

<AccordionItem title="6. « Ce poste est-il un poste d’attente avant l’ENM ? »">

**Ce qu’elle cherche.** Si vous partirez au bout d’un an, et si vous dites la vérité.

- @@0@@
- Le projet : « l’apprentissage exigeant du travail juridictionnel réel », puis le concours professionnel, sans échéance, avec un engagement sur la durée du contrat.

</AccordionItem>

<AccordionItem title="7. « Qu’est-ce qui a été difficile à Lille ? »">

**Ce qu’elle cherche.** Votre lucidité dans une juridiction chargée.

- Le vocabulaire du droit pénal des affaires, appris terme par terme.
- L’analyse de données bancaires volumineuses.
- La réticence à contredire d’autres intervenants, surmontée avec le soutien de M. Bonnet.
- Horaires étendus, charge considérable : @@2@@

</AccordionItem>

<AccordionItem title="8. « Votre mémoire porte sur les erreurs judiciaires. Les juges se trompent-ils souvent ? »">

**Ce qu’elle cherche.** Un regard critique sur les magistrats. Piège à désamorcer en une phrase.

- La critique vise le **dispositif légal de révision**, pas les magistrats : « le mécanisme de détection de l’erreur est structurellement incomplet ».
- L’erreur est une défaillance institutionnelle, jamais individuelle.
- Avoir travaillé sur la faillibilité rend plus attentive à la motivation, pas moins loyale.

</AccordionItem>

<AccordionItem title="9. « Quel usage faites-vous du numérique et de l’IA ? »">

**Ce qu’elle cherche.** Une position mesurée : l’IA « dans le respect de la déontologie ».

- Des outils d’aide à la recherche et à la rédaction, avec **vérification humaine systématique** ; jamais « l’IA rédige ».
- Ne donnez pas de date pour Mon espace Justice.

</AccordionItem>

<AccordionItem title="10. « Vous êtes de Lille. Pourquoi Béziers, et resterez-vous ? »">

**Ce qu’elle cherche.** Le risque de départ rapide.

- Mobilité nationale décidée : installation à Béziers, disponible dès maintenant, pour la durée du contrat.
- Ce qui vous attire est le poste lui-même : généraliste, au siège, dans une juridiction qui a tenu ses délais.

</AccordionItem>

</Accordion>

## Vos questions à elle

Choisissez-en deux ; l’entretien dure 30 minutes.

<Steps>

<Step title="L’affectation et le compte rendu">

« Quels services sont aujourd’hui prioritaires pour l’affectation de l’attachée de justice, et comment voyez-vous l’articulation entre le magistrat délégué, vous-même et moi ? »

</Step>

<Step title="L’organisation des attachés">

« Comment le travail est-il organisé entre les attachés et assistants, avec quelles trames ? Existe-t-il un temps de formation à l’arrivée ? »

</Step>

<Step title="Le numérique">

« Mon espace Justice et la procédure pénale numérique arrivent au moment de ma prise de poste : qu’attendez-vous de l’attachée de justice dans ce déploiement ? »

</Step>

</Steps>

<Callout type="danger" title="À ne pas poser en premier">

Le télétravail et le renouvellement du contrat. Si le temps le permet, une seule question factuelle en fin d’entretien : « Le CDD de trois ans est-il renouvelable ? »

</Callout>

## Juste avant l’entretien

<Checklist title="Les dix dernières minutes">

- Relire la lettre : la présidente l’a lue, chaque phrase peut appeler une question.
- Dire le « Présentez-vous » deux fois à voix haute.
- Réciter le § 113 et l’article L. 123-4 du COJ.
- Répéter la réponse sur le mémoire jusqu’à ce que la première phrase sorte seule.
@@1@@

</Checklist>
`;

function briefOf(pick: 'original' | 'corrected'): string {
  return CORRECTION_LIST.reduce(
    (text, correction, index) => text.replace(`@@${String(index)}@@`, correction[pick]),
    BRIEF_TEMPLATE,
  );
}

// The showcase Versions the store adds on top of the loaded snapshot, newest last: each a Draft produced
// by the AI, so the lists, the Sheet, the Posting page and the Revision all read the same state
export interface IShowcaseVersion {
  artifactKey: string;
  createdAt: string;
  fileName: string;
  text: string;
  original: string;
  inputs: IInputRef[];
}

export const SHOWCASE_VERSION_LIST: IShowcaseVersion[] = [
  {
    artifactKey: 'research',
    createdAt: '2026-11-02T07:40:00.000Z',
    fileName: 'research.mdx',
    text: RESEARCH_SHOWCASE,
    original: RESEARCH_SHOWCASE,
    inputs: [
      { key: 'job_description', label: 'Fiche de poste' },
      { key: 'notes', label: 'Notes' },
    ],
  },
  {
    artifactKey: SHOWCASE_ARTIFACT_KEY,
    createdAt: SHOWCASE_CREATED_AT,
    fileName: 'interview-brief.mdx',
    text: briefOf('corrected'),
    original: briefOf('original'),
    inputs: SHOWCASE_INPUT_LIST,
  },
];
