import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

interface ILinkedPosting {
  reference: string;
}

// The fields of a Posting that link it to its Reposts, named as the actions name them
export interface IRepost {
  repostOf: ILinkedPosting | null;
  repostList: ILinkedPosting[];
}

// The link of a Repost, both ways, as facts of the Posting page: the Posting it publishes again, and
// the Postings that publish it again. Nothing on a Posting published once.
export function RepostFacts({ posting }: Readonly<{ posting: IRepost }>) {
  const { repostOf, repostList } = posting;
  const { t } = useTranslation('posting');
  const factList = [
    ...(repostOf === null ? [] : [{ term: t('repostOfTerm'), reference: repostOf.reference }]),
    ...repostList.map(({ reference }) => ({ term: t('repostedAsTerm'), reference })),
  ];
  return factList.map(({ term, reference }) => (
    <div key={reference}>
      <dt>{term}</dt>
      <dd className="reference">
        <Link to={`/postings/${reference}`}>{reference}</Link>
      </dd>
    </div>
  ));
}
