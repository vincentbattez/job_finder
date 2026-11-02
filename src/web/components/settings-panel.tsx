import { useId, type ReactNode } from 'react';

import './settings-panel.css';

// A part of the settings, such as the Watches, the Notification Channel or the Candidates (ADR-0011):
// its heading, what it does in a paragraph, then its forms
// An anchor lets a link of the Sidebar land on the panel, such as the Watches of the Profile
export function SettingsPanel({
  heading,
  anchor,
  children,
}: Readonly<{ heading: string; anchor?: string; children: ReactNode }>) {
  const headingId = useId();
  return (
    <section className="settings-panel" id={anchor} aria-labelledby={headingId}>
      <h2 id={headingId}>{heading}</h2>
      {children}
    </section>
  );
}

// A button of a settings form and, beside it, what its last click answered
export function SettingsStep({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="settings-panel__step">{children}</div>;
}
