import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // archunit registers its matchers on the global expect as soon as it is imported
    globals: true,
    globalSetup: ['test/global-setup.ts'],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // A first launch still waits for the Prisma CLI (ADR-0004), twice in the test of an older
    // database: up to seconds on the GitHub runner or beside the linters and Playwright
    testTimeout: 15_000,
  },
});
