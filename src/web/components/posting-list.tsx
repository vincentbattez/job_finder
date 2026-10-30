import { Link } from 'react-router';

import { useCatalogue } from '#/web/catalogue.ts';

import { StatusBadge, type Status } from './badge.tsx';
import { DateText } from './date.tsx';

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
  const { postingList: copy } = useCatalogue();
  if (postingList.length === 0) {
    return <p className="empty">{copy.noPosting}</p>;
  }
  return (
    <table className="posting-list">
      <thead>
        <tr>
          <th scope="col">{copy.postingColumn}</th>
          <th scope="col">{copy.statusColumn}</th>
          <th scope="col">{copy.publishedAtColumn}</th>
          <th scope="col">{copy.deadlineColumn}</th>
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
                  <span className="reference">{posting.reference}</span>
                ) : (
                  <a className="reference" href={posting.url}>
                    {posting.reference}
                  </a>
                )}
              </div>
            </td>
            <td>
              <StatusBadge status={posting.status} isExpired={posting.isExpired} />
            </td>
            <td className="date" data-label={copy.publishedAtColumn}>
              <DateText date={posting.publishedAt} />
            </td>
            <td className="date" data-label={copy.deadlineColumn}>
              <DateText date={posting.deadline} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
