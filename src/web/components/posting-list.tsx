import { Link } from 'react-router';

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
  if (postingList.length === 0) {
    return (
      <p className="empty">
        Aucune Offre pour l’instant. Chaque Détection ajoute ici les nouvelles Offres de vos Veilles.
      </p>
    );
  }
  return (
    <table className="posting-list">
      <thead>
        <tr>
          <th scope="col">Offre</th>
          <th scope="col">Statut</th>
          <th scope="col">Publiée le</th>
          <th scope="col">Date limite</th>
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
            <td className="date" data-label="Publiée le">
              <DateText date={posting.publishedAt} />
            </td>
            <td className="date" data-label="Date limite">
              <DateText date={posting.deadline} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
