import { useId, type ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader } from '#/web/components/ui/card.tsx';

// A section of the Settings page (spec #125 « Profile, Watches, Settings »): a plain card, its heading,
// what it does in a line, then its forms. Its anchor lets a link land on it, such as the Candidates
// of the switcher's menu.
export function SettingsSection({
  heading,
  description,
  anchor,
  children,
}: Readonly<{ heading: string; description: ReactNode; anchor?: string; children: ReactNode }>) {
  const headingId = useId();
  return (
    <section id={anchor} aria-labelledby={headingId} className="scroll-mt-20">
      <Card>
        <CardHeader>
          <h2 id={headingId} className="max-w-none text-base font-semibold">
            {heading}
          </h2>
          <CardDescription className="max-w-prose">{description}</CardDescription>
        </CardHeader>
        <CardContent className="gap-6">{children}</CardContent>
      </Card>
    </section>
  );
}
