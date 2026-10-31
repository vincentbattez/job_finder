import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { StatusBadge, type Status } from './badge.tsx';
import { DateText } from './date.tsx';
import { EmptyState } from './empty-state.tsx';

import './posting-list.css';

// The fields of a Posting that the list shows, named as the actions name them
export interface IPostingRow {
  reference: string;
  title: string;
  url: string | null;
  workplace: string | null;
  status: Status;
  isExpired: boolean;
  archivedAt: Date | null;
  publishedAt: Date | null;
  deadline: Date | null;
}

// The Postings the last Detection found are marked New, until the next Detection (#63)
export function PostingList({
  postingList,
  newReferenceList = [],
}: Readonly<{ postingList: IPostingRow[]; newReferenceList?: string[] }>) {
  const { t } = useTranslation('postingList');
  if (postingList.length === 0) {
    return <EmptyState>{t('noPosting')}</EmptyState>;
  }
  return (
    <table className="posting-list" id="posting-list">
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
                {newReferenceList.includes(posting.reference) && (
                  <span className="posting-list__new">{t('newMark')}</span>
                )}
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
              <StatusBadge status={posting.status} isExpired={posting.isExpired} archivedAt={posting.archivedAt} />
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
