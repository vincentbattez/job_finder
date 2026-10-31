import { defineConfig } from 'vitest/config';

import { TimeBudgetReporter } from '../../time-budget-reporter.ts';

// The fixture project of test/time-budget.test.ts: a probe against a budget its spawn can beat on
// purpose, through the same reporter as the suite (#108)
export default defineConfig({
  test: {
    include: ['*.test.ts'],
    reporters: [new TimeBudgetReporter({ testBudgetMs: 300, suiteBudgetMs: 60_000, slowFileList: [] })],
  },
});
