import type { Reporter, TestModule } from 'vitest/node';

interface ITestDuration {
  file: string;
  name: string;
  durationMs: number;
}

interface ISlowFile {
  file: string;
  budgetMs: number;
  reason: string;
}

interface ITimeBudget {
  testBudgetMs: number;
  suiteBudgetMs: number;
  slowFileList: ISlowFile[];
}

interface ITestRun {
  testList: ITestDuration[];
  // Wall-clock of the run, from the first test to the last: the “Duration” line of Vitest
  suiteMs: number;
}

// The files whose tests may take longer than the budget, each with its own budget and the reason.
// A budget is about 1.5 times the slowest test seen in CI with both workers busy (#108).
const SLOW_FILE_LIST: ISlowFile[] = [
  { file: 'test/spellcheck.test.ts', budgetMs: 20_000, reason: 'spawns scripts/spellcheck.sh, two cspell passes' },
  {
    file: 'test/actions.test.ts',
    budgetMs: 12_000,
    reason: 'migrates an older database with the Prisma CLI (ADR-0004)',
  },
  {
    file: 'test/data-layout.test.ts',
    budgetMs: 10_000,
    reason: 'migrates an older layout with the Prisma CLI (ADR-0004)',
  },
  { file: 'test/architecture.test.ts', budgetMs: 12_000, reason: 'builds the archunit graph of the whole project' },
  {
    file: 'test/time-budget.test.ts',
    budgetMs: 15_000,
    reason: 'spawns a Vitest on the fixture project, the proof of this guard',
  },
];

// Calibrated on the GitHub runner, 2 vCPU and both Vitest workers busy, which stretches every test
// (#108). Per test: 1.5 times the slowest unlisted test seen there (3.9 s). Suite: 1.25 times the
// slowest of three runs (142 s), the runner itself varying by about 30 % from one run to the next.
// The suite budget holds per CI shard (.github/workflows/ci.yml).
const BUDGET: ITimeBudget = { testBudgetMs: 6000, suiteBudgetMs: 180_000, slowFileList: SLOW_FILE_LIST };

export function findOverBudget({ testList, suiteMs }: ITestRun, budget: ITimeBudget): string[] {
  const budgetOf = (file: string) =>
    budget.slowFileList.find((slowTest) => file === slowTest.file)?.budgetMs ?? budget.testBudgetMs;
  const violationList = testList
    .filter(({ file, durationMs }) => durationMs > budgetOf(file))
    .map(
      ({ file, name, durationMs }) =>
        `${file} > ${name}: ${String(Math.round(durationMs))} ms, budget ${String(budgetOf(file))} ms`,
    );
  return suiteMs > budget.suiteBudgetMs
    ? [...violationList, `the suite: ${String(Math.round(suiteMs))} ms, budget ${String(budget.suiteBudgetMs)} ms`]
    : violationList;
}

// Fails the run in CI when a test or the suite goes over its budget; elsewhere it only reports, the
// durations varying too much with the cores and the other agents of a development machine (#108)
export class TimeBudgetReporter implements Reporter {
  readonly #budget: ITimeBudget;
  #startedAt = 0;

  constructor(budget: ITimeBudget = BUDGET) {
    this.#budget = budget;
  }

  onTestRunStart(): void {
    this.#startedAt = performance.now();
  }

  onTestRunEnd(testModuleList: ReadonlyArray<TestModule>): void {
    const testList = testModuleList.flatMap((testModule) =>
      [...testModule.children.allTests()].map((testCase) => ({
        file: testModule.relativeModuleId,
        name: testCase.fullName,
        durationMs: testCase.diagnostic()?.duration ?? 0,
      })),
    );
    const violationList = findOverBudget({ testList, suiteMs: performance.now() - this.#startedAt }, this.#budget);
    if (violationList.length === 0) {
      return;
    }
    const report = violationList.map((violation) => `  ${violation}`).join('\n');
    console.error(`\nOver the time budget:\n${report}`);
    if (process.env.CI !== undefined) {
      process.exitCode = 1;
    }
  }
}
