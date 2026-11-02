import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

import { Button } from '#/web/components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '#/web/components/ui/tooltip.tsx';

// Light or dark: next-themes sets the .dark class on <html> and remembers the choice in this browser;
// until one is made, the system's applies. Both icons render and CSS shows the right one, so the
// server's page and the browser's agree.
export function ThemeToggle() {
  const { t } = useTranslation('shell');
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('theme.toggle')}
          onClick={() => {
            setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
          }}
        >
          <SunIcon className="dark:hidden" />
          <MoonIcon className="hidden dark:block" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('theme.toggle')}</TooltipContent>
    </Tooltip>
  );
}
