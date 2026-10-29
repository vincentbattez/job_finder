import { spawnSync } from 'node:child_process';

export interface IAiSession {
  openInteractive(session: { prompt: string; directory: string }): void;
}

// The only file that knows the AI runs on Claude Code, through the subscription and never an API
// key (ADR-0003): the rest of the app sees an IAiSession, which the tests replace with a fake.
export const CLAUDE_CODE: IAiSession = {
  // The fixed prompt goes into the system prompt so the Candidat does not see it as their own
  // message; the opening line only gets Claude to speak first.
  openInteractive({ prompt, directory }) {
    const { status, error } = spawnSync('claude', ['--append-system-prompt', prompt, 'Bonjour !'], {
      cwd: directory,
      stdio: 'inherit',
    });
    if (error !== undefined) {
      throw new Error(`Impossible de lancer Claude Code (${error.message}). Installer « claude » et s'y connecter.`);
    }
    if (status !== 0) {
      throw new Error(`La session Claude Code s'est arrêtée en erreur (code ${String(status)}).`);
    }
  },
};
