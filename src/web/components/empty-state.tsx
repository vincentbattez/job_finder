import type { ReactNode } from 'react';

import './empty-state.css';

// What stands where a list will be once it has something, such as the Postings or the Profile files
export function EmptyState({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="empty-state">{children}</div>;
}
