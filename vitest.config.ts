import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // archunit registers its matchers on the global expect as soon as it is imported
    globals: true,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
