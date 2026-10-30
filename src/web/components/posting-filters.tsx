import { Form, useSearchParams } from 'react-router';

import { useCatalogue } from '#/web/catalogue.ts';

import type { Status } from './badge.tsx';

interface IFilteredPosting {
  status: Status;
  city: string | null;
  region: string | null;
}

// The Postings of the city and the region chosen, the Archived only when asked: the list and the
// map show the same ones
export function filterPostings<T extends IFilteredPosting>(postingList: T[], searchParameters: URLSearchParams): T[] {
  const city = searchParameters.get('city') ?? '';
  const region = searchParameters.get('region') ?? '';
  const isArchivedShown = searchParameters.has('archived');
  return postingList.filter(
    (posting) =>
      (city === '' || posting.city === city) &&
      (region === '' || posting.region === region) &&
      (isArchivedShown || posting.status !== 'archived'),
  );
}

function listChoices(valueList: (string | null)[]): string[] {
  const choiceList = valueList.filter((value) => value !== null);
  return [...new Set(choiceList)].toSorted((left, right) => left.localeCompare(right, 'fr'));
}

// A plain GET form: the filters live in the URL and work before React hydrates the page
export function PostingFilters({ postingList }: Readonly<{ postingList: IFilteredPosting[] }>) {
  const { posting: copy } = useCatalogue();
  const [searchParameters] = useSearchParams();
  return (
    <Form role="search" aria-label={copy.filtersLabel} className="filters" key={searchParameters.toString()}>
      <label>
        {copy.cityFilter}
        <select name="city" defaultValue={searchParameters.get('city') ?? ''}>
          <option value="">{copy.allChoices}</option>
          {listChoices(postingList.map(({ city }) => city)).map((city) => (
            <option key={city}>{city}</option>
          ))}
        </select>
      </label>
      <label>
        {copy.regionFilter}
        <select name="region" defaultValue={searchParameters.get('region') ?? ''}>
          <option value="">{copy.allChoices}</option>
          {listChoices(postingList.map(({ region }) => region)).map((region) => (
            <option key={region}>{region}</option>
          ))}
        </select>
      </label>
      <label className="filters__check">
        <input type="checkbox" name="archived" defaultChecked={searchParameters.has('archived')} />
        {copy.showArchived}
      </label>
      <button type="submit">{copy.filter}</button>
    </Form>
  );
}
