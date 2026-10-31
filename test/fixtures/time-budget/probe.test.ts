import { expect, it } from 'vitest';

// Busy-waits for TIME_BUDGET_PROBE_MS: the one injected slow test the guard has to catch (#108)
it('the probe is slow', () => {
  const probeMs = Number(process.env.TIME_BUDGET_PROBE_MS ?? 50);
  const end = performance.now() + probeMs;
  while (performance.now() < end) {
    // spins until the deadline: a timer would not count as the test's own time
  }
  expect(performance.now()).toBeGreaterThanOrEqual(end);
});
