import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { findOverBudget } from './time-budget-reporter.ts';

const FIXTURE_DIRECTORY = path.join(import.meta.dirname, 'fixtures', 'time-budget');
const VITEST_PATH = path.join(import.meta.dirname, '..', 'node_modules', 'vitest', 'vitest.mjs');
const SPAWN_TIMEOUT = 60_000;

// Runs the fixture project, a probe busy-waiting for the given time against a 300 ms budget, in a
// Vitest of its own that reports through the reporter; CI is set, or not, as the environment says
function runFixture(probeMs: number, { isCi }: { isCi: boolean }): { status: number | null; stderr: string } {
  const { status, stderr } = spawnSync(process.execPath, [VITEST_PATH, 'run'], {
    cwd: FIXTURE_DIRECTORY,
    // An undefined value leaves the variable out, CI's included when the suite itself runs in CI
    env: { ...process.env, CI: isCi ? 'true' : undefined, TIME_BUDGET_PROBE_MS: String(probeMs) },
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT,
  });
  return { status, stderr };
}

const BUDGET = {
  testBudgetMs: 1000,
  suiteBudgetMs: 10_000,
  slowFileList: [{ file: 'test/slow.test.ts', budgetMs: 5000, reason: 'spawns a CLI' }],
};

// Each test and the whole run keep under a time budget, so the suite never drifts back to minutes
// (CODING_STANDARDS “Tests”, #108)
describe('the time budget', () => {
  it('reports a test over the budget, with its duration and its budget', () => {
    const run = {
      testList: [
        { file: 'test/fast.test.ts', name: 'is quick', durationMs: 20 },
        { file: 'test/fast.test.ts', name: 'is slow', durationMs: 1800.4 },
      ],
      suiteMs: 2000,
    };
    expect(findOverBudget(run, BUDGET)).toEqual(['test/fast.test.ts > is slow: 1800 ms, budget 1000 ms']);
  });

  it('lets a listed file use its own budget', () => {
    const run = {
      testList: [
        { file: 'test/slow.test.ts', name: 'spawns', durationMs: 4000 },
        { file: 'test/slow.test.ts', name: 'spawns twice', durationMs: 6000 },
      ],
      suiteMs: 9000,
    };
    expect(findOverBudget(run, BUDGET)).toEqual(['test/slow.test.ts > spawns twice: 6000 ms, budget 5000 ms']);
  });

  it('reports the suite over its budget, even when every test is under its own', () => {
    const run = {
      testList: Array.from({ length: 20 }, () => ({ file: 'test/fast.test.ts', name: 'a case', durationMs: 600 })),
      suiteMs: 12_000,
    };
    expect(findOverBudget(run, BUDGET)).toEqual(['the suite: 12000 ms, budget 10000 ms']);
  });

  // The proof that the guard fails a run: a fixture project with an injected slow probe
  describe('on a probe over the budget, in CI', { timeout: SPAWN_TIMEOUT }, () => {
    it('fails the run and names the probe, its duration and its budget', () => {
      const { status, stderr } = runFixture(500, { isCi: true });
      expect(stderr).toMatch(/Over the time budget:\n {2}probe\.test\.ts > the probe is slow: 5\d\d ms, budget 300 ms/);
      expect(status).toBe(1);
    });

    it('passes the run of a probe under the budget', () => {
      const { status, stderr } = runFixture(50, { isCi: true });
      expect(stderr).not.toContain('Over the time budget');
      expect(status).toBe(0);
    });

    it('only reports it outside CI', () => {
      const { status, stderr } = runFixture(500, { isCi: false });
      expect(stderr).toContain('probe.test.ts > the probe is slow');
      expect(status).toBe(0);
    });
  });
});
