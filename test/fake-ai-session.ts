import { writeFileSync } from 'node:fs';
import path from 'node:path';

import type { IHeadlessResult, IHeadlessSession, IInteractiveSession } from '#/ai-session/acl/claude-code.ts';

interface IPlannedRun {
  fileByName?: Record<string, string>;
  isSuccess?: boolean;
}

// Stands in for Claude Code, an external boundary: records each session instead of opening it. A
// headless session writes the files planned for it in its output folder, as Claude would, one
// planned run per session in order; past the plan, it writes nothing.
export function createFakeAiSession(...plannedRunList: IPlannedRun[]) {
  const interactiveSessionList: IInteractiveSession[] = [];
  const headlessSessionList: IHeadlessSession[] = [];
  return {
    interactiveSessionList,
    headlessSessionList,
    openInteractive(session: IInteractiveSession): void {
      interactiveSessionList.push(session);
    },
    runHeadless(session: IHeadlessSession): Promise<IHeadlessResult> {
      headlessSessionList.push(session);
      const { fileByName = {}, isSuccess = true } = plannedRunList.shift() ?? {};
      for (const [fileName, content] of Object.entries(fileByName)) {
        writeFileSync(path.join(session.outputDirectory, fileName), content);
      }
      const log = isSuccess ? 'La Recherche est écrite.' : 'Claude Code a rencontré une erreur.';
      return Promise.resolve({ isSuccess, sessionId: `fake-session-${String(headlessSessionList.length)}`, log });
    },
  };
}
