import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// Every temporary folder of a run lands under one root the global setup creates and its teardown
// removes (#109): the tests, and the processes they spawn, read it through TMPDIR
describe('temporary folders', () => {
  it('go under the root of the run in a test worker', () => {
    expect(path.basename(tmpdir())).toMatch(/^job-finder-run-/);
  });

  it('go under the same root in a process a test spawns', () => {
    const spawnedTmpdir = execFileSync(process.execPath, ['-p', 'os.tmpdir()'], { encoding: 'utf8', timeout: 10_000 });
    expect(spawnedTmpdir.trim()).toBe(tmpdir());
  });
});
