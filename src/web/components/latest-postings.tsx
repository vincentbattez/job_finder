import { useTranslation } from 'react-i18next';

import type { Step } from './badge.tsx';
import { EmptyState } from './empty-state.tsx';
import { PostingMap } from './posting-map.tsx';
import { PostingTile, type IPostingTile } from './posting-tile.tsx';
import { SectionHead } from './section-head.tsx';

import './latest-postings.css';

// What a tile and a point of the map read of a Posting
interface ILatestPosting extends IPostingTile {
  step: Step;
  archivedAt: Date | null;
  unpublishedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
}

// What just arrived in the Zone, as tiles and on the map, with the way to every Posting
export function LatestPostings({ postingList }: Readonly<{ postingList: ILatestPosting[] }>) {
  const { t } = useTranslation('home');
  return (
    <section aria-labelledby="latest-postings-heading" className="latest-postings">
      <SectionHead
        headingId="latest-postings-heading"
        heading={t('latestHeading')}
        link={{ to: '/postings', label: t('allPostingsLink') }}
      />
      {postingList.length === 0 ? (
        <EmptyState>{t('noLatestPosting')}</EmptyState>
      ) : (
        <div className="latest-postings__body">
          <ul className="latest-postings__tiles">
            {postingList.map((posting) => (
              <li key={posting.reference}>
                <PostingTile posting={posting} />
              </li>
            ))}
          </ul>
          <PostingMap postingList={postingList} />
        </div>
      )}
    </section>
  );
}
