import type { ReactNode } from 'react';

import './button-row.css';

// The buttons of a form side by side, then a quiet note of what they did or would do
export function ButtonRow({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="button-row">{children}</div>;
}
