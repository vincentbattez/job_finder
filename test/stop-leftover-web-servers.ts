import { execFileSync } from 'node:child_process';

function run(command: string, argumentList: string[]) {
  try {
    return execFileSync(command, argumentList, { encoding: 'utf8' });
  } catch {
    // lsof and ps exit non-zero when they find nothing
    return '';
  }
}

// A run killed before its end (SIGKILL, a parallel mise task stopped) leaves its web servers on their
// port, and the next run fails on EADDRINUSE. Playwright starts each in its own process group: stop
// the groups listening on these ports, only when they run from this checkout, never another worktree
export function stopLeftoverWebServers({
  portList,
  checkoutDirectory,
}: {
  portList: string[];
  checkoutDirectory: string;
}) {
  const pidList = run('lsof', ['-t', '-sTCP:LISTEN', ...portList.map((port) => `-iTCP:${port}`)])
    .split('\n')
    .filter((pid) => pid !== '');
  for (const pid of pidList) {
    const cwd = run('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'])
      .split('\n')
      .find((line) => line.startsWith('n'));
    const processGroup = Number(run('ps', ['-o', 'pgid=', '-p', pid]).trim());
    if (cwd === `n${checkoutDirectory}` && processGroup > 1) {
      process.kill(-processGroup, 'SIGKILL');
    }
  }
}
