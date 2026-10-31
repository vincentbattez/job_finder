import { spawn, spawnSync } from 'node:child_process';
import { hostname } from 'node:os';

import { z } from 'zod/v4';

import { tFor } from '#/domain/catalogue/i18n.ts';
import { codedError } from '#/domain/coded-error.ts';
import type { ErrorCode } from '#/domain/error.ts';
import { SESSION_RESULT_SCHEMA, type Locale, type SessionResult } from '#/domain/index.ts';
import { messageOf } from '#/text/index.ts';

export interface IInteractiveSession {
  prompt: string;
  directory: string;
  // Given, the session is confined to its directory, and may never change these paths or globs
  readOnlyPathList?: string[];
  // That of the Candidate, for what the session tells them
  locale: Locale;
}

// The fixed part of a module's prompt, then its Instructions (ADR-0003); the session writes only in
// its output folder
export interface IHeadlessSession {
  fixedPrompt: string;
  instructions: string;
  directory: string;
  readDirectoryList: string[];
  outputDirectory: string;
  // That of the Candidate, for the log of a session that failed
  locale: Locale;
}

export interface IAiSession {
  openInteractive(session: IInteractiveSession): void;
  runHeadless(session: IHeadlessSession): Promise<SessionResult>;
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

// A headless session that never returns would hold the whole queue behind it (claimNextJob): past
// this, it is stopped and its job fails. A Research and its web searches take minutes.
export const MAX_SESSION_DURATION_MS = 30 * 60_000;

// The single JSON object `claude -p --output-format json` prints
const CLAUDE_RESULT_SCHEMA = z.object({
  subtype: z.string(),
  is_error: z.boolean(),
  session_id: z.string(),
  result: z.string().default(''),
});

// What claude -p says, in English, when it refuses a session because its login expired or the
// subscription reached its limit: only its own wording, so that a session's error that merely mentions
// a login page or a quota stays a failed session (#41)
const REFUSAL_LIST: { code: ErrorCode; pattern: RegExp }[] = [
  { code: 'claude_usage_limit', pattern: /Claude AI usage limit|usage limit reached|you've hit your limit/i },
  {
    code: 'claude_login_required',
    pattern: /Please run \/login|Invalid API key|OAuth token (?:has )?expired|Not logged in/i,
  },
];

// A session past its maximum duration gets SIGTERM; one still alive this long after gets SIGKILL
const KILL_GRACE_MS = 10_000;

// A failure Claude Code names, under its code; its message tells on which machine to act, the one
// the session runs on
function failedSession(
  code: ErrorCode,
  values: Record<string, string>,
  { locale, sessionId = null }: { locale: Locale; sessionId?: string | null },
): SessionResult {
  const { message } = codedError(code, { host: hostname(), ...values }, { locale });
  return SESSION_RESULT_SCHEMA.parse({ isSuccess: false, sessionId, log: message, errorCode: code });
}

function parseResult(output: string): z.infer<typeof CLAUDE_RESULT_SCHEMA> | null {
  try {
    return CLAUDE_RESULT_SCHEMA.parse(JSON.parse(output));
  } catch {
    return null;
  }
}

// Without its JSON, what claude wrote to stderr is the only reason of its crash
function readResult(output: string, stderr: string, exitCode: number | null, locale: Locale): SessionResult {
  const result = parseResult(output);
  if (result === null) {
    const outputList = [output, stderr].map((text) => text.trim()).filter((text) => text !== '');
    return SESSION_RESULT_SCHEMA.parse({
      isSuccess: false,
      sessionId: null,
      log: tFor(locale, 'error')('sessionStopped', { exitCode: String(exitCode), output: outputList.join('\n') }),
      errorCode: null,
    });
  }
  const refusal = result.is_error ? REFUSAL_LIST.find(({ pattern }) => pattern.test(result.result)) : undefined;
  if (refusal !== undefined) {
    return failedSession(refusal.code, { result: result.result }, { locale, sessionId: result.session_id });
  }
  return SESSION_RESULT_SCHEMA.parse({
    isSuccess: exitCode === 0 && !result.is_error && result.subtype === 'success',
    sessionId: result.session_id,
    log: result.result === '' ? result.subtype : result.result,
    errorCode: null,
  });
}

// The only file that knows the AI runs on Claude Code, through the subscription and never an API
// key (ADR-0003): the rest of the app sees an IAiSession, which the tests replace with a fake. A
// headless session is stopped past sessionTimeoutMs, then killed past killGraceMs more.
export function createClaudeCode(sessionTimeoutMs: number, killGraceMs = KILL_GRACE_MS): IAiSession {
  return {
    // The prompt goes into the system prompt, not the Candidate's messages; the manual mode asks their
    // consent to each edit, and a confined session has no shell that could get round its read-only paths
    openInteractive({ prompt, directory, readOnlyPathList, locale }) {
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
        tFor(locale, 'cli')('sessionGreeting'),
      ];
      const { status, signal, error } = spawnSync('claude', argumentList, {
        cwd: directory,
        env: subscriptionEnvironment(),
        stdio: 'inherit',
      });
      if (error !== undefined) {
        throw codedError('session_not_launched', { reason: error.message }, { locale, cause: error });
      }
      if (signal !== null) {
        throw codedError('session_killed', { signal, host: hostname() }, { locale });
      }
      if (status !== 0) {
        throw codedError('interactive_session_failed', { status: String(status) }, { locale });
      }
    },

    // The fixed part goes into the system prompt so that no Instructions can lift its rules (ADR-0003);
    // cspell:words dontAsk
    // dontAsk refuses any tool not listed. A session that cannot run is a failed one, never a throw.
    async runHeadless({ fixedPrompt, instructions, directory, readDirectoryList, outputDirectory, locale }) {
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
      // The timeout kills a session that never returns, which child.killed then tells from a kill
      // from outside
      const child = spawn('claude', argumentList, {
        cwd: directory,
        env: subscriptionEnvironment(),
        stdio: 'pipe',
        timeout: sessionTimeoutMs,
      });
      // A claude deaf to the SIGTERM of the timeout would still hold its job, and the queue behind it
      const killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      }, sessionTimeoutMs + killGraceMs);
      child.on('exit', () => {
        clearTimeout(killTimer);
      });
      // A claude that exits before reading its message tells why through its exit
      child.stdin
        .on('error', () => {
          // its exit says it
        })
        .end(instructions);
      let output = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        output += chunk;
      });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        stderr += chunk;
      });
      try {
        const { exitCode, signal } = await new Promise<{ exitCode: number | null; signal: string | null }>(
          (resolve, reject) => {
            const settle = (exitCode: number | null, signal: string | null) => {
              resolve({ exitCode, signal });
            };
            // A killed claude may leave a child process holding its output open: its exit is enough
            child
              .on('exit', (exitCode, signal) => {
                if (signal !== null) {
                  settle(exitCode, signal);
                }
              })
              .on('close', settle)
              .on('error', reject);
          },
        );
        if (signal === null) {
          return readResult(output, stderr, exitCode, locale);
        }
        return child.killed
          ? failedSession('session_timed_out', { minutes: String(Math.round(sessionTimeoutMs / 60_000)) }, { locale })
          : failedSession('session_killed', { signal }, { locale });
      } catch (error) {
        clearTimeout(killTimer);
        return failedSession('session_not_launched', { reason: messageOf(error) }, { locale });
      }
    },
  };
}

export const CLAUDE_CODE = createClaudeCode(MAX_SESSION_DURATION_MS);
