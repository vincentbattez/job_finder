import { useRef, useState } from 'react';

// The front is served over plain http on the LAN and through WireGuard (ADR-0002), where browsers
// withhold the Clipboard API: the command is selected and copied the way every browser still allows
function copySelected(element: HTMLElement | null): void {
  if (element === null) {
    return;
  }
  globalThis.getSelection()?.selectAllChildren(element);
  document.execCommand('copy');
}

export function CopyCommand({ command }: Readonly<{ command: string }>) {
  const commandElement = useRef<HTMLElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  return (
    <div className="command">
      <code ref={commandElement}>{command}</code>
      <button
        type="button"
        onClick={() => {
          copySelected(commandElement.current);
          setIsCopied(true);
        }}
      >
        {isCopied ? 'Copiée' : 'Copier'}
      </button>
    </div>
  );
}
