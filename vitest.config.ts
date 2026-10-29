import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // archunit registers its matchers on the global expect as soon as it is imported
    globals: true,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Even when the shell exports them: no test may send a real notification
    // (test/home-assistant.test.ts)
    env: { HOME_ASSISTANT_URL: '', HOME_ASSISTANT_TOKEN: '' },
    // Each createActions migrates its data folder through the Prisma CLI, in a process of its
    // own (ADR-0004): 0.3 s on the Mac mini, 0.75 s on the GitHub runner, several times that when
    // mise run ci runs the linters, Vitest and Playwright side by side. A test that opens its
    // folder three times and runs two Détections then nears Vitest's default 5 s.
    testTimeout: 15_000,
  },
});
