import { Link } from 'react-router';

import './section-head.css';

interface ISectionHead {
  // What the section's aria-labelledby names
  headingId: string;
  heading: string;
  // The page that lists everything the section only previews
  link?: { to: string; label: string } | undefined;
}

// The heading of a section of the home or of /applications, the way to its full page beside it
export function SectionHead({ headingId, heading, link }: Readonly<ISectionHead>) {
  return (
    <div className="section-head">
      <h2 id={headingId}>{heading}</h2>
      {link !== undefined && <Link to={link.to}>{link.label}</Link>}
    </div>
  );
}
