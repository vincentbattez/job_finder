import { useTranslation } from 'react-i18next';
import { Form, useSearchParams } from 'react-router';

import type { Status } from './badge.tsx';

import './posting-filters.css';

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
  const { t } = useTranslation('posting');
  const [searchParameters] = useSearchParams();
  return (
    <Form role="search" aria-label={t('filtersLabel')} className="posting-filters" key={searchParameters.toString()}>
      <label>
        {t('cityFilter')}
        <select
          className="button posting-filters__control"
          name="city"
          defaultValue={searchParameters.get('city') ?? ''}
        >
          <option value="">{t('allChoices')}</option>
          {listChoices(postingList.map(({ city }) => city)).map((city) => (
            <option key={city}>{city}</option>
          ))}
        </select>
      </label>
      <label>
        {t('regionFilter')}
        <select
          className="button posting-filters__control"
          name="region"
          defaultValue={searchParameters.get('region') ?? ''}
        >
          <option value="">{t('allChoices')}</option>
          {listChoices(postingList.map(({ region }) => region)).map((region) => (
            <option key={region}>{region}</option>
          ))}
        </select>
      </label>
      <label className="posting-filters__check">
        <input type="checkbox" name="archived" defaultChecked={searchParameters.has('archived')} />
        {t('showArchived')}
      </label>
      <button className="button button--primary posting-filters__control" type="submit">
        {t('filter')}
      </button>
    </Form>
  );
}
