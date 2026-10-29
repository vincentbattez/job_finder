import { Form, useSearchParams } from 'react-router';

import type { Statut } from './badge.tsx';

interface IFilteredOffre {
  status: Statut;
  city: string | null;
  region: string | null;
}

// The Offres of the ville and the région chosen, the Archivées only when asked: the list and the
// map show the same ones
export function filterOffres<T extends IFilteredOffre>(offreList: T[], searchParameters: URLSearchParams): T[] {
  const city = searchParameters.get('ville') ?? '';
  const region = searchParameters.get('region') ?? '';
  const isArchiveeShown = searchParameters.has('archivees');
  return offreList.filter(
    (offre) =>
      (city === '' || offre.city === city) &&
      (region === '' || offre.region === region) &&
      (isArchiveeShown || offre.status !== 'archivee'),
  );
}

function listChoices(valueList: (string | null)[]): string[] {
  const choiceList = valueList.filter((value) => value !== null);
  return [...new Set(choiceList)].toSorted((left, right) => left.localeCompare(right, 'fr'));
}

// A plain GET form: the filters live in the URL and work before React hydrates the page
export function OffreFilters({ offreList }: Readonly<{ offreList: IFilteredOffre[] }>) {
  const [searchParameters] = useSearchParams();
  return (
    <Form role="search" aria-label="Filtres" className="filters" key={searchParameters.toString()}>
      <label>
        Ville
        <select name="ville" defaultValue={searchParameters.get('ville') ?? ''}>
          <option value="">Toutes</option>
          {listChoices(offreList.map(({ city }) => city)).map((city) => (
            <option key={city}>{city}</option>
          ))}
        </select>
      </label>
      <label>
        Région
        <select name="region" defaultValue={searchParameters.get('region') ?? ''}>
          <option value="">Toutes</option>
          {listChoices(offreList.map(({ region }) => region)).map((region) => (
            <option key={region}>{region}</option>
          ))}
        </select>
      </label>
      <label className="filters__check">
        <input type="checkbox" name="archivees" defaultChecked={searchParameters.has('archivees')} />
        Afficher les Archivées
      </label>
      <button type="submit">Filtrer</button>
    </Form>
  );
}
