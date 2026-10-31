import { useId, type ReactNode } from 'react';

import { ApplicationRow, type Application } from './application-row.tsx';
import { EmptyState } from './empty-state.tsx';
import { SectionHead } from './section-head.tsx';

import './application-list.css';

interface IApplicationList {
  heading: string;
  // The page that lists every Application, from a section that only shows some
  link?: { to: string; label: string };
  // What stands in place of the rows when there is none
  emptyText: string;
  applicationList: Application[];
  // The outcome selector of each row, from the Container (ADR-0008)
  renderOutcomeSelector: (application: Application) => ReactNode;
}

// A section of Application rows: the home shows those in progress, /applications each of its sections
export function ApplicationList({
  heading,
  link,
  emptyText,
  applicationList,
  renderOutcomeSelector,
}: Readonly<IApplicationList>) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="application-list">
      <SectionHead headingId={headingId} heading={heading} link={link} />
      {applicationList.length === 0 ? (
        <EmptyState>{emptyText}</EmptyState>
      ) : (
        <ul className="application-list__rows">
          {applicationList.map((application) => (
            <li key={application.posting.reference}>
              <ApplicationRow application={application} outcomeSelector={renderOutcomeSelector(application)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
