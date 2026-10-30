import type { ReactNode } from 'react';

import './worker-task.css';

// A task the worker runs in its own process (ADR-0003), such as a module or a conversion: its state
// and the button that starts it, then why it waits and what the last start failed on
export function WorkerTask({
  refusal,
  error,
  children,
}: Readonly<{ refusal?: string | null | undefined; error?: string | null | undefined; children: ReactNode }>) {
  return (
    <div className="worker-task">
      {children}
      {refusal != null && <p className="worker-task__refusal">{refusal}</p>}
      {error != null && <p role="alert">{error}</p>}
    </div>
  );
}
