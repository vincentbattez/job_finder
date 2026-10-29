import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // archunit registers its matchers on the global expect as soon as it is imported
    globals: true,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Even when the shell exports them: no test may send a real notification
    // (test/home-assistant.test.ts)
    env: { HOME_ASSISTANT_URL: '', HOME_ASSISTANT_TOKEN: '' },
  },
});
