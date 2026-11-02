// PROTOTYPE. Light or dark: next-themes sets the .dark class on <html> and remembers the choice; until
// the Candidate picks one, the system's applies. Both icons render, CSS shows the right one, so the
// server and the browser agree.
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '#/web/prototype/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/web/prototype/components/ui/tooltip.tsx';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Basculer le thème clair ou sombre"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          <SunIcon className="dark:hidden" />
          <MoonIcon className="hidden dark:block" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Thème clair / sombre</TooltipContent>
    </Tooltip>
  );
}
