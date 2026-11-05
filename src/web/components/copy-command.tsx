import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '#/web/components/ui/button.tsx';

// Over plain http on the LAN (ADR-0002), browsers withhold the Clipboard API: a hidden field is
// copied the way every browser still allows
function copyText(text: string): void {
  const focusedElement = document.activeElement;
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  Object.assign(field.style, { position: 'fixed', top: '0', opacity: '0' });
  document.body.append(field);
  field.select();
  field.setSelectionRange(0, text.length);
  document.execCommand('copy');
  field.remove();
  if (focusedElement instanceof HTMLElement) {
    focusedElement.focus();
  }
}

function CopyButton({ text, label, copiedLabel }: Readonly<{ text: string; label: string; copiedLabel: string }>) {
  const [isCopied, setIsCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        copyText(text);
        setIsCopied(true);
      }}
    >
      {isCopied ? copiedLabel : label}
    </Button>
  );
}

export function CopyCommand({ command }: Readonly<{ command: string }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">{command}</code>
      <CopyButton text={command} label={t('copy')} copiedLabel={t('copiedCommand')} />
    </div>
  );
}
