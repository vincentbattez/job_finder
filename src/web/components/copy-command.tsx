import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
    <button
      type="button"
      onClick={() => {
        copyText(text);
        setIsCopied(true);
      }}
    >
      {isCopied ? copiedLabel : label}
    </button>
  );
}

export function CopyCommand({ command }: Readonly<{ command: string }>) {
  const { t } = useTranslation('posting');
  return (
    <div className="command">
      <code>{command}</code>
      <CopyButton text={command} label={t('copy')} copiedLabel={t('copiedCommand')} />
    </div>
  );
}

// A document as Markdown, as it goes into a mail
export function CopyMarkdown({ markdown }: Readonly<{ markdown: string }>) {
  const { t } = useTranslation('posting');
  return <CopyButton text={markdown} label={t('copyMarkdown')} copiedLabel={t('copiedMarkdown')} />;
}
