import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Badge } from './badge.tsx';
import { DateText } from './date.tsx';

import './posting-tile.css';

// The fields of a Posting that a tile shows, named as the actions name them
export interface IPostingTile {
  reference: string;
  title: string;
  employer: string | null;
  city: string | null;
  deadline: Date | null;
  isExpired: boolean;
  publishedAt: Date | null;
}

// A Posting at a glance: where, for whom, until when
export function PostingTile({ posting }: Readonly<{ posting: IPostingTile }>) {
  const { t } = useTranslation('home');
  return (
    <article className="posting-tile">
      <Link className="posting-tile__title" to={`/postings/${posting.reference}`}>
        {posting.title}
      </Link>
      {posting.employer !== null && <span className="posting-tile__employer">{posting.employer}</span>}
      {posting.city !== null && <span className="posting-tile__city">{posting.city}</span>}
      <dl className="posting-tile__dates">
        <dt>{t('deadlineLabel')}</dt>
        <dd className="posting-tile__deadline">
          <DateText date={posting.deadline} />
          {posting.isExpired && <Badge data-status="expired">{t('expired', { ns: 'common' })}</Badge>}
        </dd>
        <dt>{t('publishedAtLabel')}</dt>
        <dd>
          <DateText date={posting.publishedAt} />
        </dd>
      </dl>
    </article>
  );
}
