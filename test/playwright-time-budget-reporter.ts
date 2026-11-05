import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

import { findOverBudget, type ITimeBudget } from './time-budget-reporter.ts';

// On the GitHub runner, where the spec gives an e2e test 6 s (spec #125); the run's budget holds per CI
// shard, as for Vitest. No file has a budget of its own: each was brought under it.
const BUDGET: ITimeBudget = { testBudgetMs: 6000, suiteBudgetMs: 180_000, slowFileList: [] };

// Playwright's side of TimeBudgetReporter: fails the run in CI when a test or the run goes over its
// budget, and elsewhere only reports. A failed test already fails the run, its duration being a timeout's.
export default class PlaywrightTimeBudgetReporter implements Reporter {
  readonly #budget: ITimeBudget;
  readonly #testList: { file: string; name: string; durationMs: number }[] = [];
  #startedAt = 0;

  // Playwright hands over the options of the config, which give none: only a test gives a budget
  constructor({ budget = BUDGET }: { budget?: ITimeBudget } = {}) {
    this.#budget = budget;
  }

  onBegin(): void {
    this.#startedAt = performance.now();
  }

  onTestEnd(test: Pick<TestCase, 'title' | 'location'>, result: Pick<TestResult, 'status' | 'duration'>): void {
    if (result.status === 'passed') {
      this.#testList.push({ file: test.location.file, name: test.title, durationMs: result.duration });
    }
  }

  onEnd(): Promise<{ status: 'failed' } | undefined> {
    const violationList = findOverBudget(
      { testList: this.#testList, suiteMs: performance.now() - this.#startedAt },
      this.#budget,
    );
    if (violationList.length === 0) {
      return Promise.resolve(undefined);
    }
    const report = violationList.map((violation) => `  ${violation}`).join('\n');
    console.error(`\nOver the time budget:\n${report}`);
    return Promise.resolve(process.env.CI === undefined ? undefined : { status: 'failed' });
  }
}
