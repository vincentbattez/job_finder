import { Link } from 'react-router';

import { StatutBadge, type Statut } from './badge.tsx';
import { DateText } from './date.tsx';

// The fields of an Offre that the list shows, named as the actions name them
export interface IOffreRow {
  reference: string;
  title: string;
  url: string | null;
  workplace: string | null;
  status: Statut;
  isExpiree: boolean;
  publishedAt: Date | null;
  dateLimite: Date | null;
}

export function OffreList({ offreList }: Readonly<{ offreList: IOffreRow[] }>) {
  if (offreList.length === 0) {
    return (
      <p className="empty">
        Aucune Offre pour l’instant. Chaque Détection ajoute ici les nouvelles Offres de vos Veilles.
      </p>
    );
  }
  return (
    <table className="offre-list">
      <thead>
        <tr>
          <th scope="col">Offre</th>
          <th scope="col">Statut</th>
          <th scope="col">Publiée le</th>
          <th scope="col">Date limite</th>
        </tr>
      </thead>
      <tbody>
        {offreList.map((offre) => (
          <tr key={offre.reference}>
            <td>
              <div className="offre-list__offre">
                <Link className="offre-list__title" to={`/offres/${offre.reference}`}>
                  {offre.title}
                </Link>
                {offre.workplace !== null && <span className="offre-list__workplace">{offre.workplace}</span>}
                {offre.url === null ? (
                  <span className="reference">{offre.reference}</span>
                ) : (
                  <a className="reference" href={offre.url}>
                    {offre.reference}
                  </a>
                )}
              </div>
            </td>
            <td>
              <StatutBadge statut={offre.status} isExpiree={offre.isExpiree} />
            </td>
            <td className="date" data-label="Publiée le">
              <DateText date={offre.publishedAt} />
            </td>
            <td className="date" data-label="Date limite">
              <DateText date={offre.dateLimite} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
