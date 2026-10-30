import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { StatusBadge, type Status } from './badge.tsx';
import { DateText } from './date.tsx';

import './posting-list.css';

// The fields of a Posting that the list shows, named as the actions name them
export interface IPostingRow {
  reference: string;
  title: string;
  url: string | null;
  workplace: string | null;
  status: Status;
  isExpired: boolean;
  publishedAt: Date | null;
  deadline: Date | null;
}

export function PostingList({ postingList }: Readonly<{ postingList: IPostingRow[] }>) {
  const { t } = useTranslation('postingList');
  if (postingList.length === 0) {
    return <p className="posting-list__empty">{t('noPosting')}</p>;
  }
  return (
    <table className="posting-list">
      <thead>
        <tr>
          <th scope="col">{t('postingColumn')}</th>
          <th scope="col">{t('statusColumn')}</th>
          <th scope="col">{t('publishedAtColumn')}</th>
          <th scope="col">{t('deadlineColumn')}</th>
        </tr>
      </thead>
      <tbody>
        {postingList.map((posting) => (
          <tr key={posting.reference}>
            <td>
              <div className="posting-list__posting">
                <Link className="posting-list__title" to={`/postings/${posting.reference}`}>
                  {posting.title}
                </Link>
                {posting.workplace !== null && <span className="posting-list__workplace">{posting.workplace}</span>}
                {posting.url === null ? (
                  <span className="posting-list__reference">{posting.reference}</span>
                ) : (
                  <a className="posting-list__reference" href={posting.url}>
                    {posting.reference}
                  </a>
                )}
              </div>
            </td>
            <td>
              <StatusBadge status={posting.status} isExpired={posting.isExpired} />
            </td>
            <td className="posting-list__date" data-column="publishedAt" data-label={t('publishedAtColumn')}>
              <DateText date={posting.publishedAt} />
            </td>
            <td className="posting-list__date" data-label={t('deadlineColumn')}>
              <DateText date={posting.deadline} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
