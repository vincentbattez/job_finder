import { Link } from 'react-router';

interface ILinkedOffre {
  reference: string;
}

// The fields of an Offre that link it to its Republications, named as the actions name them
export interface IRepublication {
  republicationOf: ILinkedOffre | null;
  republicationList: ILinkedOffre[];
}

// The link of a Republication, both ways, as facts of the fiche: the Offre it publishes again, and
// the Offres that publish it again. Nothing on an Offre published once.
export function RepublicationFacts({ offre }: Readonly<{ offre: IRepublication }>) {
  const { republicationOf, republicationList } = offre;
  const factList = [
    ...(republicationOf === null ? [] : [{ term: 'Republication de', reference: republicationOf.reference }]),
    ...republicationList.map(({ reference }) => ({ term: 'Republiée en', reference })),
  ];
  return factList.map(({ term, reference }) => (
    <div key={reference}>
      <dt>{term}</dt>
      <dd className="reference">
        <Link to={`/offres/${reference}`}>{reference}</Link>
      </dd>
    </div>
  ));
}
