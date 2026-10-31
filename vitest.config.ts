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
    // A first launch still waits for the Prisma CLI (ADR-0004), twice in the test of an older
    // database: up to seconds on the GitHub runner or beside the linters and Playwright
    testTimeout: 15_000,
  },
});
