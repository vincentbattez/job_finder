import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLAUDE_CODE } from '#/ai-session/acl/claude-code.ts';

const FAKE_CLAUDE_DIRECTORY = path.join(import.meta.dirname, 'fixtures', 'claude');

const SESSION = {
  fixedPrompt: "Tu produis la Recherche d'une Offre.\nN'invente jamais un fait.",
  consignes: 'Va droit au but.\n',
};

function createDirectory(): string {
  return mkdtempSync(path.join(tmpdir(), 'job-finder-claude-'));
}

// Puts the fake claude of test/fixtures/claude on the PATH, answering with the given output
function stubClaude(output: object, exitCode = 0): string {
  const recordDirectory = createDirectory();
  vi.stubEnv('PATH', `${FAKE_CLAUDE_DIRECTORY}:/usr/bin:/bin`);
  vi.stubEnv('FAKE_CLAUDE_RECORD', recordDirectory);
  vi.stubEnv('FAKE_CLAUDE_OUTPUT', JSON.stringify(output));
  vi.stubEnv('FAKE_CLAUDE_EXIT_CODE', String(exitCode));
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

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory, outputDirectory: '/donnees/recherche/v1' });

    expect(result).toEqual({ isSuccess: true, sessionId: 'session-1', log: 'Fait.' });
    const argumentList = readRecord(recordDirectory, 'arguments').split('\0');
    expect(argumentList).toEqual(expect.arrayContaining(['-p', 'dontAsk', 'Edit(//donnees/recherche/v1/**)']));
    expect(argumentList[argumentList.indexOf('--append-system-prompt') + 1]).toBe(SESSION.fixedPrompt);
    expect(readRecord(recordDirectory, 'message')).toBe(SESSION.consignes);
    expect(readRecord(recordDirectory, 'directory').trim()).toBe(realpathSync(directory));
    expect(readRecord(recordDirectory, 'environment')).not.toMatch(/^(?:ANTHROPIC_API_KEY|CLAUDECODE)=/m);
  });

  it('reports a session that ended in error, with its session id', async () => {
    stubClaude({ subtype: 'error_max_turns', is_error: true, session_id: 'session-2' }, 1);

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    expect(result).toEqual({ isSuccess: false, sessionId: 'session-2', log: 'error_max_turns' });
  });

  it('reports a Claude Code that cannot be launched', async () => {
    vi.stubEnv('PATH', createDirectory());

    const result = await CLAUDE_CODE.runHeadless({ ...SESSION, directory: createDirectory(), outputDirectory: '/v1' });

    expect(result).toMatchObject({ isSuccess: false, sessionId: null, log: /Impossible de lancer Claude Code/ });
  });
});

describe('the interactive launch of Claude Code', () => {
  it('confines a session with read-only paths to its directory, without shell, web nor customization', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'cle-de-test');
    const recordDirectory = stubClaude({});
    const directory = createDirectory();

    CLAUDE_CODE.openInteractive({
      prompt: SESSION.fixedPrompt,
      directory,
      readOnlyPathList: ['/donnees/offre/**/brouillon.md'],
    });

    const argumentList = readRecord(recordDirectory, 'arguments').split('\0');
    expect(argumentList).toEqual(expect.arrayContaining(['--restricted', '--safe-mode', 'manual']));
    expect(argumentList[argumentList.indexOf('--disallowedTools') + 1]).toBe('Edit(//donnees/offre/**/brouillon.md)');
    expect(argumentList[argumentList.indexOf('--append-system-prompt') + 1]).toBe(SESSION.fixedPrompt);
    expect(readRecord(recordDirectory, 'directory').trim()).toBe(realpathSync(directory));
    expect(readRecord(recordDirectory, 'environment')).not.toMatch(/^ANTHROPIC_API_KEY=/m);
  });
});
