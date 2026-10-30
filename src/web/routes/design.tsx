import { useTranslation } from 'react-i18next';
import type { LoaderFunctionArgs, MetaArgs } from 'react-router';

import { localeOf, tFor } from '#/actions/i18n.ts';
import { readCandidate } from '#/web/candidate.server.ts';
import { STATE_LIST, StateBadge, StatusBadge, type Status } from '#/web/components/badge.tsx';
import { MarkdownEditor } from '#/web/components/markdown-editor.tsx';
import { PostingDetail, type IPostingDetail } from '#/web/components/posting-detail.tsx';
import { PostingList, type IPostingRow } from '#/web/components/posting-list.tsx';

// Sample values that read as samples: the real Postings reach the front through the actions (ADR-0003).
// They are French Postings, as the Sources publish them.
// cspell:disable
const SAMPLE_POSTING = {
  reference: '2026-0000101',
  title: 'Attaché de justice (F/H), pôle civil',
  url: 'https://example.org/postings/2026-0000101',
  workplace: 'Tribunal judiciaire de Béthune',
  employer: 'Cour d’appel de Douai',
  status: 'to_apply',
  isExpired: false,
  publishedAt: new Date('2026-10-20'),
  deadline: new Date('2026-11-19'),
  applicationEmail: 'recrutement@example.org',
  contact1: 'Greffe du pôle civil, 03 00 00 00 00',
  contact2: null,
  repostOf: { reference: '2026-0000042' },
  repostList: [],
} satisfies IPostingDetail['posting'];

const SAMPLE_JOB_DESCRIPTION = [
  '## Missions',
  '',
  'L’attaché de justice assiste les magistrats du pôle civil : recherches juridiques, notes de synthèse et projets de décision.',
  '',
  '## Profil recherché',
  '',
  '- Master 2 en droit privé',
  '- Goût du travail en équipe',
].join('\n');

function sampleVersion(number: number, state: 'running' | 'ready' | 'failed') {
  return {
    version: {
      number,
      state,
      isChosen: number === 1,
      hasCandidateInstructions: number === 2,
      instructions: 'Établis ce que les recruteurs attendent pour cette Offre.',
      createdAt: new Date('2026-10-21'),
    },
    isChoosable: false,
    documentList: [],
  };
}

// One Artifact in each state, that of its latest Version
const SAMPLE_POSTING_DETAIL: IPostingDetail = {
  posting: SAMPLE_POSTING,
  jobDescription: SAMPLE_JOB_DESCRIPTION,
  artifactList: [
    {
      artifact: 'research',
      state: 'ready',
      module: { refusal: null },
      isEditable: true,
      versionList: [sampleVersion(1, 'ready')],
    },
    {
      artifact: 'letter',
      state: 'in_progress',
      module: { refusal: null },
      isEditable: true,
      versionList: [sampleVersion(1, 'ready'), sampleVersion(2, 'running')],
    },
    {
      artifact: 'interview_brief',
      state: 'failed',
      module: { refusal: null },
      isEditable: false,
      versionList: [sampleVersion(1, 'failed')],
    },
    {
      artifact: 'visualization',
      state: 'absent',
      module: { refusal: 'Il faut d’abord une Fiche d’entretien retenue.' },
      isEditable: false,
      versionList: [],
    },
  ],
  recipients: {
    to: { email: 'recrutement@example.org', source: 'applicationEmail' },
    ccList: [],
    salutation: { text: 'Madame, Monsieur,', source: null },
    justification: 'Le mail de candidature est la seule adresse publiée ; aucun contact ne donne de nom.',
  },
};

const SAMPLE_LETTER = [
  'Madame, Monsieur,',
  '',
  'Titulaire d’un [à compléter : diplôme], je souhaite rejoindre le pôle civil du tribunal judiciaire de Béthune comme attachée de justice.',
  '',
  '## Ce que j’apporte',
  '',
  '- [à compléter : une expérience en juridiction]',
  '- Des notes de synthèse claires et sourcées',
].join('\n');

const SAMPLE_POSTING_LIST: IPostingRow[] = [
  SAMPLE_POSTING,
  {
    reference: '2026-0000102',
    title: 'Attaché de justice (F/H), parquet',
    url: 'https://example.org/postings/2026-0000102',
    workplace: 'Tribunal judiciaire de Boulogne-sur-Mer',
    status: 'applied',
    isExpired: true,
    publishedAt: new Date('2026-09-25'),
    deadline: new Date('2026-10-23'),
  },
  {
    reference: '2026-0000103',
    title: 'Attaché de justice (F/H), pôle mineurs',
    url: 'https://example.org/postings/2026-0000103',
    workplace: 'Tribunal judiciaire d’Avesnes-sur-Helpe',
    status: 'to_apply',
    isExpired: true,
    publishedAt: new Date('2026-09-14'),
    deadline: new Date('2026-10-15'),
  },
  {
    reference: '2026-0000104',
    title: 'Attaché de justice (F/H), service de l’application des peines',
    url: 'https://example.org/postings/2026-0000104',
    workplace: 'Tribunal judiciaire d’Amiens',
    status: 'archived',
    isExpired: false,
    publishedAt: new Date('2026-09-30'),
    deadline: null,
  },
];

// cspell:enable

// Each look of the badge: Expired shows in place of To Apply
const STATUS_SAMPLE_LIST: { status: Status; isExpired: boolean }[] = [
  { status: 'to_apply', isExpired: false },
  { status: 'applied', isExpired: false },
  { status: 'to_apply', isExpired: true },
  { status: 'archived', isExpired: false },
];

// The chrome of the page reads in the chosen Candidate's locale; the samples stay French Postings, as
// the Sources publish them
export function loader({ request }: LoaderFunctionArgs) {
  return readCandidate(request);
}

export function meta({ loaderData }: MetaArgs<typeof loader>) {
  const t = tFor(localeOf(loaderData), 'settings');
  return [{ title: t('design.pageTitle') }, { name: 'description', content: t('design.description') }];
}

export default function Design() {
  const { t } = useTranslation('settings');
  return (
    <main className="container page">
      <div className="page__head">
        <h1>{t('design.heading')}</h1>
        <p>{t('design.intro')}</p>
      </div>
      <section aria-labelledby="statuses">
        <h2 id="statuses">{t('design.statuses')}</h2>
        <ul className="badge-list">
          {STATUS_SAMPLE_LIST.map(({ status, isExpired }) => (
            <li key={`${status}-${String(isExpired)}`}>
              <StatusBadge status={status} isExpired={isExpired} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="states">
        <h2 id="states">{t('design.states')}</h2>
        <ul className="badge-list">
          {STATE_LIST.map((state) => (
            <li key={state}>
              <StateBadge state={state} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="postings">
        <h2 id="postings">{t('design.postingList')}</h2>
        <PostingList postingList={SAMPLE_POSTING_LIST} />
      </section>
      <section aria-labelledby="empty-list">
        <h2 id="empty-list">{t('design.emptyList')}</h2>
        <PostingList postingList={[]} />
      </section>
      <section aria-labelledby="posting-detail">
        <h2 id="posting-detail">{t('design.postingDetail')}</h2>
        <PostingDetail detail={SAMPLE_POSTING_DETAIL} />
      </section>
      <section aria-labelledby="editor">
        <h2 id="editor">{t('design.editor')}</h2>
        <MarkdownEditor
          label={t('artifactLabelByArtifact.letter', { ns: 'common' })}
          defaultValue={SAMPLE_LETTER}
          placeholder="Madame, Monsieur,"
        />
      </section>
    </main>
  );
}
