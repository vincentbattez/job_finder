import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { codedError } from '#/domain/coded-error.ts';
import type { Artifact, Candidate, Job, Version } from '#/domain/index.ts';
import { convertBroughtPdf } from '#/modules/conversion/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import { AI_MODULE_BY_ARTIFACT } from './registry.ts';
import type { JobFailure } from './session.ts';

// The conversion of a PDF the Candidate brought: like an Upload's, it copies the PDF into Markdown, here the
// text file of a Version of theirs, a Draft with no Original (ADR-0019); it runs nothing of the Artifact's
// module, so it reads no Inputs and has no Instructions
export async function runBroughtConversion(
  { workspace, aiSession }: { workspace: Workspace; aiSession: IAiSession },
  job: Job & { module: Artifact; upload: string },
  candidate: Candidate,
): Promise<{ job: Job; version: Version; failure: JobFailure | undefined }> {
  const { posting, module, upload } = job;
  const { locale } = candidate;
  const version = await workspace.startJob(job, {
    instructions: '',
    hasCandidateInstructions: false,
    inputList: [],
    origin: 'candidate',
  });
  const directory = workspace.createVersionDirectory(posting, version);
  const pdfFileName = workspace.moveBroughtPdf(posting, upload, version);
  const outputFileName = AI_MODULE_BY_ARTIFACT[module].fileName;
  const session = await convertBroughtPdf(aiSession, candidate, { directory, pdfFileName, outputFileName });
  const text = workspace.readVersionFile(posting, version, outputFileName) ?? '';
  function problemOf(): JobFailure | undefined {
    if (session.errorCode !== null) {
      return { code: session.errorCode, message: session.log };
    }
    if (!session.isSuccess) {
      return codedError('session_failed', {}, { locale });
    }
    return text.trim() === ''
      ? codedError('conversion_without_file', { upload: pdfFileName, log: session.log }, { locale })
      : undefined;
  }
  const problem = problemOf();
  // The log starts with the message of the failure's code, unless the session named it already
  const log = problem === undefined || session.errorCode !== null ? session.log : `${problem.message}\n${session.log}`;
  const finished = await workspace.finishJob(
    { job, version },
    { errorCode: problem?.code ?? null, log, sessionId: session.sessionId },
  );
  return { ...finished, failure: problem };
}
