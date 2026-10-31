import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // archunit registers its matchers on the global expect as soon as it is imported
    globals: true,
    globalSetup: ['test/global-setup.ts'],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Every core runs a test file: the GitHub runner of a private repo has 2 vCPU, and the Vitest
    // default of availableParallelism() - 1 left one of them idle and the files in single file
    maxWorkers: '100%',
    // Twice the slowest test on the GitHub runner with both workers busy: the migrations of an older
    // database (test/actions.test.ts), which wait for the Prisma CLI (ADR-0004), take 5 to 8 s
    // there, a spread the runner alone explains. The spellcheck wiring sets its own timeout
    testTimeout: 15_000,
  },
});
