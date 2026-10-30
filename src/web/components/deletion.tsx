import type { ReactNode } from 'react';

import './deletion.css';

// Folded, so a deletion always takes a second, deliberate click, with or without JavaScript: the
// summary names what goes, the unfolded form holds the button in the color of what cannot be undone
export function Deletion({ summary, children }: Readonly<{ summary: ReactNode; children: ReactNode }>) {
  return (
    <details className="deletion">
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
