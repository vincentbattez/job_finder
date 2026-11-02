import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLAUDE_CODE, createClaudeCode, type IHeadlessSession } from '#/ai-session/acl/claude-code.ts';

const FAKE_CLAUDE_DIRECTORY = path.join(import.meta.dirname, 'fixtures', 'claude');

const SESSION: Omit<IHeadlessSession, 'directory' | 'outputDirectory'> = {
  fixedPrompt: "Tu produis la Recherche d'une Offre.\nN'invente jamais un fait.",
  message: 'Va droit au but.\n',
  locale: 'fr',
};

function createDirectory(): string {
  return mkdtempSync(path.join(tmpdir(), 'job-finder-claude-'));
}

interface IFakeClaudeBehavior {
  // Written to stderr before it exits
  stderr?: string;
  // The signal that kills it, such as KILL
  signal?: string;
  // Never ends, as a session waiting on the network or on a question
  isHanging?: boolean;
  // Ignores SIGTERM, so that only SIGKILL stops it
  isDeafToTerm?: boolean;
}

// Puts the fake claude of test/fixtures/claude on the PATH, answering with the given output, JSON
// or raw text
function stubClaude(output: object | string, exitCode = 0, behavior: IFakeClaudeBehavior = {}): string {
  const recordDirectory = createDirectory();
  vi.stubEnv('PATH', `${FAKE_CLAUDE_DIRECTORY}:/usr/bin:/bin`);
  vi.stubEnv('FAKE_CLAUDE_RECORD', recordDirectory);
  vi.stubEnv('FAKE_CLAUDE_OUTPUT', typeof output === 'string' ? output : JSON.stringify(output));
  vi.stubEnv('FAKE_CLAUDE_EXIT_CODE', String(exitCode));
  vi.stubEnv('FAKE_CLAUDE_STDERR', behavior.stderr ?? '');
  vi.stubEnv('FAKE_CLAUDE_SIGNAL', behavior.signal ?? '');
  vi.stubEnv('FAKE_CLAUDE_HANG', behavior.isHanging === true ? '1' : '');
  vi.stubEnv('FAKE_CLAUDE_IGNORE_TERM', behavior.isDeafToTerm === true ? '1' : '');
  return recordDirectory;
}

function readRecord(recordDirectory: string, name: string): string {
  return readFileSync(path.join(recordDirectory, name), 'utf8');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the headless launch of Claude Code', () => {
  it('runs claude -p on the subscription, never with an API key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'cle-de-test');
    vi.stubEnv('CLAUDECODE', '1');
    const recordDirectory = stubClaude({
      subtype: 'success',
      is_error: false,
      session_id: 'session-1',
      result: 'Fait.',
    });
    const directory = createDirectory();

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory, outputDirectory: '/donnees/research/v1' });

    expect(result).toEqual({ isSuccess: true, sessionId: 'session-1', log: 'Fait.', errorCode: null });
    const argumentList = readRecord(recordDirectory, 'arguments').split('\0');
    expect(argumentList).toEqual(expect.arrayContaining(['-p', 'dontAsk', 'Edit(//donnees/research/v1/**)']));
    expect(argumentList).not.toContain('--add-dir');
    expect(argumentList[argumentList.indexOf('--append-system-prompt') + 1]).toBe(SESSION.fixedPrompt);
    expect(readRecord(recordDirectory, 'message')).toBe(SESSION.message);
    expect(readRecord(recordDirectory, 'directory').trim()).toBe(realpathSync(directory));
    expect(readRecord(recordDirectory, 'environment')).not.toMatch(/^(?:ANTHROPIC_API_KEY|CLAUDECODE)=/m);
  });

  // A subagent takes on part of the work, and reports only what serves the Artifact
  it('lets the session delegate its reading to subagents', async () => {
    const recordDirectory = stubClaude({ subtype: 'success', is_error: false, session_id: 'session-4' });

    await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    const argumentList = readRecord(recordDirectory, 'arguments').split('\0');
    expect(argumentList[argumentList.indexOf('--tools') + 1]?.split(',')).toContain('Agent');
    expect(argumentList.slice(argumentList.indexOf('--allowedTools'))).toContain('Agent');
  });

  // Its Inputs come inlined in its message: it reads no folder besides its own (ADR-0021)
  it('gives the session no folder besides its own, and its fixed part as system prompt', async () => {
    const recordDirectory = stubClaude({ subtype: 'success', is_error: false, session_id: 'session-3' });

    await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    const argumentList = readRecord(recordDirectory, 'arguments').split('\0');
    expect(argumentList).not.toContain('--add-dir');
    expect(argumentList[argumentList.indexOf('--append-system-prompt') + 1]).toBe(SESSION.fixedPrompt);
  });

  it('reports a session that ended in error, with its session id', async () => {
    stubClaude({ subtype: 'error_max_turns', is_error: true, session_id: 'session-2' }, 1);

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    expect(result).toEqual({ isSuccess: false, sessionId: 'session-2', log: 'error_max_turns', errorCode: null });
  });

  // A session that never returns would hold the queue behind it (claimNextJob): it is stopped
  it('stops a session that never returns after its maximum duration, and says what to do', async () => {
    stubClaude('', 0, { isHanging: true });

    const result = await createClaudeCode(300).runHeadless({
      ...SESSION,
      directory: createDirectory(),
      outputDirectory: '/v1',
    });

    expect(result).toMatchObject({ isSuccess: false, sessionId: null, errorCode: 'session_timed_out' });
    expect(result.log).toMatch(/a dépassé sa durée maximale/);
    expect(result.log).toContain(`ssh ${hostname()}`);
  });

  // SIGTERM alone leaves a claude that ignores it running, and its job "Running" forever
  it('kills a session that ignores the stop past its maximum duration', async () => {
    stubClaude('', 0, { isHanging: true, isDeafToTerm: true });

    const result = await createClaudeCode(300, 300).runHeadless({
      ...SESSION,
      directory: createDirectory(),
      outputDirectory: '/v1',
    });

    expect(result).toMatchObject({ isSuccess: false, sessionId: null, errorCode: 'session_timed_out' });
  });

  // cspell:words login
  it('tells how to log back in when Claude Code refuses the session for its authentication', async () => {
    stubClaude(
      { subtype: 'success', is_error: true, session_id: 'session-4', result: 'Invalid API key · Please run /login' },
      1,
    );

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    expect(result).toMatchObject({ isSuccess: false, sessionId: 'session-4', errorCode: 'claude_login_required' });
    expect(result.log).toContain(`« ssh ${hostname()} », lancer « claude » puis taper « /login »`);
    expect(result.log).toContain('Invalid API key · Please run /login');
  });

  it('tells to wait when Claude Code has reached its usage limit', async () => {
    stubClaude(
      {
        subtype: 'success',
        is_error: true,
        session_id: 'session-5',
        result: 'Claude AI usage limit reached|1793000000',
      },
      1,
    );

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    expect(result).toMatchObject({ isSuccess: false, sessionId: 'session-5', errorCode: 'claude_usage_limit' });
    expect(result.log).toMatch(/limite d'usage/);
  });

  // Only Claude Code's own wording of a refusal: a module's error that mentions a login page is no refusal
  it('keeps an error result that merely mentions a login page a failed session', async () => {
    stubClaude(
      {
        subtype: 'error_max_turns',
        is_error: true,
        session_id: 'session-6',
        result: 'Reached max turns while reading the login page of the recruitment site (HTTP 429, quota).',
      },
      1,
    );

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    expect(result).toMatchObject({ isSuccess: false, sessionId: 'session-6', errorCode: null });
  });

  it('keeps in the log what a claude that crashed without its JSON wrote to stderr', async () => {
    stubClaude('', 1, { stderr: 'Error: EACCES: permission denied, open /Users/lea/.claude.json' });

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    expect(result).toMatchObject({ isSuccess: false, sessionId: null, errorCode: null });
    expect(result.log).toContain('Error: EACCES: permission denied, open /Users/lea/.claude.json');
  });

  it('names the signal that killed a headless session, never “code null”', async () => {
    stubClaude('', 0, { signal: 'KILL' });

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    expect(result).toMatchObject({ isSuccess: false, errorCode: 'session_killed', log: /SIGKILL/ });
    expect(result.log).not.toMatch(/code null/);
  });

  it('reports a Claude Code that cannot be launched', async () => {
    vi.stubEnv('PATH', createDirectory());

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    expect(result).toMatchObject({
      isSuccess: false,
      sessionId: null,
      errorCode: 'session_not_launched',
      log: /Impossible de lancer Claude Code/,
    });
  });
});

describe('the interactive launch of Claude Code', () => {
  it('tells how to read why an interactive session ended in error', () => {
    stubClaude({}, 3);

    expect(() => {
      CLAUDE_CODE.openInteractive({ prompt: 'Bonjour', directory: createDirectory(), locale: 'fr' });
    }).toThrow(
      "La session Claude Code s'est arrêtée en erreur (code 3). Relancer la commande ; si l'erreur revient, lancer « claude » seul pour lire son message.",
    );
  });

  it('names the signal that killed an interactive session, never “code null”', () => {
    stubClaude({}, 0, { signal: 'KILL' });

    expect(() => {
      CLAUDE_CODE.openInteractive({ prompt: 'Bonjour', directory: createDirectory(), locale: 'fr' });
    }).toThrow(/^Claude Code a été arrêté par le signal SIGKILL/);
  });

  it('confines a session with read-only paths to its directory, without shell, web nor customization', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'cle-de-test');
    const recordDirectory = stubClaude({});
    const directory = createDirectory();

    CLAUDE_CODE.openInteractive({
      prompt: SESSION.fixedPrompt,
      directory,
      readOnlyPathList: ['/donnees/posting/**/draft.md'],
      locale: 'fr',
    });

    const argumentList = readRecord(recordDirectory, 'arguments').split('\0');
    expect(argumentList).toEqual(expect.arrayContaining(['--restricted', '--safe-mode', 'manual']));
    expect(argumentList[argumentList.indexOf('--disallowedTools') + 1]).toBe('Edit(//donnees/posting/**/draft.md)');
    expect(argumentList[argumentList.indexOf('--append-system-prompt') + 1]).toBe(SESSION.fixedPrompt);
    expect(readRecord(recordDirectory, 'directory').trim()).toBe(realpathSync(directory));
    expect(readRecord(recordDirectory, 'environment')).not.toMatch(/^ANTHROPIC_API_KEY=/m);
  });
});
