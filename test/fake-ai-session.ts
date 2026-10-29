import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import type { IHeadlessResult, IHeadlessSession, IInteractiveSession } from '#/ai-session/acl/claude-code.ts';

interface IPlannedRun {
  fileByName?: Record<string, string>;
  isSuccess?: boolean;
  // The worker is stopped during this session, which then never ends
  isInterrupted?: boolean;
  // The launch throws this error instead of running the session
  errorMessage?: string;
}

// Long enough for another worker to start a session meanwhile, if it could
const SESSION_DURATION_MS = 20;

// Stands in for Claude Code, an external boundary: records each session instead of opening it. A
// headless session writes the files planned for it in its output folder, as Claude would, one
// planned run per session in order; past the plan, it writes nothing. It also counts the sessions
// running at the same time.
export function createFakeAiSession(...plannedRunList: IPlannedRun[]) {
  const interactiveSessionList: IInteractiveSession[] = [];
  const headlessSessionList: IHeadlessSession[] = [];
  let runningSessionCount = 0;
  let maxSimultaneousSessionCount = 0;
  return {
    interactiveSessionList,
    headlessSessionList,
    get maxSimultaneousSessionCount(): number {
      return maxSimultaneousSessionCount;
    },
    openInteractive(session: IInteractiveSession): void {
      interactiveSessionList.push(session);
    },
    async runHeadless(session: IHeadlessSession): Promise<IHeadlessResult> {
      headlessSessionList.push(session);
      const sessionId = `fake-session-${String(headlessSessionList.length)}`;
      const { fileByName = {}, isSuccess = true, isInterrupted = false, errorMessage } = plannedRunList.shift() ?? {};
      if (isInterrupted) {
        return new Promise<never>(() => {
          // never settles
        });
      }
      if (errorMessage !== undefined) {
        throw new Error(errorMessage);
      }
      runningSessionCount += 1;
      maxSimultaneousSessionCount = Math.max(maxSimultaneousSessionCount, runningSessionCount);
      await setTimeout(SESSION_DURATION_MS);
      runningSessionCount -= 1;
      for (const [fileName, content] of Object.entries(fileByName)) {
        writeFileSync(path.join(session.outputDirectory, fileName), content);
      }
      const log = isSuccess ? 'La Recherche est écrite.' : 'Claude Code a rencontré une erreur.';
      return { isSuccess, sessionId, log };
    },
  };
}
