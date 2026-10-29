import { spawn, spawnSync } from 'node:child_process';

import { z } from 'zod/v4';

import { messageOf } from '#/text/index.ts';

export interface IInteractiveSession {
  prompt: string;
  directory: string;
  // Given, the session is confined to its directory, and may never change these paths or globs
  readOnlyPathList?: string[];
}

// The two parts of a module's prompt (ADR-0003): the fixed part, then the Consignes. The session
// reads in its directory and in the other folders it is given, and may write only in its output
// folder.
export interface IHeadlessSession {
  fixedPrompt: string;
  consignes: string;
  directory: string;
  readDirectoryList: string[];
  outputDirectory: string;
}

export interface IHeadlessResult {
  isSuccess: boolean;
  sessionId: string | null;
  log: string;
}

export interface IAiSession {
  openInteractive(session: IInteractiveSession): void;
  runHeadless(session: IHeadlessSession): Promise<IHeadlessResult>;
}

// What would bill an API key or another provider instead of the subscription, or tell claude it
// runs inside the Claude Code session that launched jf
const STRIPPED_VARIABLE_SET = new Set([
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_CHILD_SESSION',
]);

function subscriptionEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !STRIPPED_VARIABLE_SET.has(name)));
}

// The single JSON object `claude -p --output-format json` prints
const CLAUDE_RESULT_SCHEMA = z.object({
  subtype: z.string(),
  is_error: z.boolean(),
  session_id: z.string(),
  result: z.string().default(''),
});

function readResult(output: string, exitCode: number | null): IHeadlessResult {
  try {
    const result = CLAUDE_RESULT_SCHEMA.parse(JSON.parse(output));
    return {
      isSuccess: exitCode === 0 && !result.is_error && result.subtype === 'success',
      sessionId: result.session_id,
      log: result.result === '' ? result.subtype : result.result,
    };
  } catch {
    return {
      isSuccess: false,
      sessionId: null,
      log: `Claude Code s'est arrêté (code ${String(exitCode)}) : ${output}`,
    };
  }
}

// The only file that knows the AI runs on Claude Code, through the subscription and never an API
// key (ADR-0003): the rest of the app sees an IAiSession, which the tests replace with a fake.
export const CLAUDE_CODE: IAiSession = {
  // The fixed prompt goes into the system prompt so the Candidat does not see it as their own
  // message; the opening line only gets Claude to speak first. The manual mode, whatever the
  // user's settings say, shows the Candidat each file edit and waits for their consent.
  // A confined session has no shell that could get round its read-only paths, no web, nothing
  // outside its directory, and none of the user's CLAUDE.md, hooks or MCP servers.
  openInteractive({ prompt, directory, readOnlyPathList }) {
    const confinementList =
      readOnlyPathList === undefined
        ? []
        : [
            '--restricted',
            '--safe-mode',
            // An absolute path takes a double slash in a permission rule
            ...readOnlyPathList.flatMap((readOnlyPath) => ['--disallowedTools', `Edit(/${readOnlyPath})`]),
          ];
    const argumentList = [
      ...confinementList,
      '--permission-mode',
      'manual',
      '--append-system-prompt',
      prompt,
      'Bonjour !',
    ];
    const { status, error } = spawnSync('claude', argumentList, {
      cwd: directory,
      env: subscriptionEnvironment(),
      stdio: 'inherit',
    });
    if (error !== undefined) {
      throw new Error(`Impossible de lancer Claude Code (${error.message}). Installer « claude » et s'y connecter.`);
    }
    if (status !== 0) {
      throw new Error(
        `La session Claude Code s'est arrêtée en erreur (code ${String(status)}). Relancer la commande ; si l'erreur revient, lancer « claude » seul pour lire son message.`,
      );
    }
  },

  // The fixed part goes into the system prompt, above the Consignes sent as the message, so that
  // no Consignes can lift its rules. The safe mode leaves out the user's CLAUDE.md, hooks, skills
  // and MCP servers; dontAsk refuses any tool not listed, so the session reads, searches the web
  // and writes only in its output folder. Never fails: a session that cannot run is a failed one.
  async runHeadless({ fixedPrompt, consignes, directory, readDirectoryList, outputDirectory }) {
    const argumentList = [
      '-p',
      '--output-format',
      'json',
      '--safe-mode',
      '--permission-mode',
      'dontAsk',
      '--tools',
      'Read,Glob,Grep,Write,Edit,WebSearch,WebFetch',
      '--allowedTools',
      'Read',
      'Glob',
      'Grep',
      'WebSearch',
      'WebFetch',
      // An absolute path takes a double slash in a permission rule
      `Edit(/${outputDirectory}/**)`,
      ...readDirectoryList.flatMap((readDirectory) => ['--add-dir', readDirectory]),
      '--append-system-prompt',
      fixedPrompt,
    ];
    const child = spawn('claude', argumentList, {
      cwd: directory,
      env: subscriptionEnvironment(),
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    child.stdin.end(consignes);
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
    });
    try {
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        child.on('close', resolve).on('error', reject);
      });
      return readResult(output, exitCode);
    } catch (error) {
      const message = messageOf(error);
      const log = `Impossible de lancer Claude Code (${message}). Installer « claude » et s'y connecter.`;
      return { isSuccess: false, sessionId: null, log };
    }
  },
};
