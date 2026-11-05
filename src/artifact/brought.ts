import type { IAiSession } from '#/ai-session/acl/claude-code.ts';
import { codedError } from '#/domain/coded-error.ts';
import { CUSTOM_ARTIFACT_FILE_NAME, type Artifact, type Candidate, type Job, type Version } from '#/domain/index.ts';
import { convertBroughtPdf } from '#/modules/conversion/index.ts';
import type { Workspace } from '#/workspace/index.ts';

import { AI_MODULE_BY_ARTIFACT } from './registry.ts';
import type { JobFailure } from './session.ts';

type Dependencies = { workspace: Workspace; aiSession: IAiSession };

// The conversion of a PDF the Candidate brought: like an Upload's, it copies the PDF into Markdown, the text
// file of a Version of theirs; it runs nothing of an Artifact's module, so it reads no Inputs and has no
// Instructions
async function convertIntoVersion(
  { workspace, aiSession }: Dependencies,
  { job, version, upload, outputFileName }: { job: Job; version: Version; upload: string; outputFileName: string },
  candidate: Candidate,
): Promise<{ job: Job; version: Version; failure: JobFailure | undefined }> {
  const { posting } = job;
  const { locale } = candidate;
  const directory = workspace.createVersionDirectory(posting, version);
  const pdfFileName = workspace.moveBroughtPdf(posting, upload, version);
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

// A Version of the Artifact, a Draft with no Original (ADR-0019), created as the job starts
export async function runBroughtConversion(
  dependencies: Dependencies,
  job: Job & { module: Artifact; upload: string },
  candidate: Candidate,
): Promise<{ job: Job; version: Version; failure: JobFailure | undefined }> {
  const version = await dependencies.workspace.startJob(job, {
    instructions: '',
    hasCandidateInstructions: false,
    inputList: [],
    origin: 'candidate',
  });
  const outputFileName = AI_MODULE_BY_ARTIFACT[job.module].fileName;
  return convertIntoVersion(dependencies, { job, version, upload: job.upload, outputFileName }, candidate);
}

// The single Version of a Custom Artifact, which its job came with (spec #125)
export function runCustomConversion(
  dependencies: Dependencies,
  job: Job & { version: Version; upload: string },
  candidate: Candidate,
): Promise<{ job: Job; version: Version; failure: JobFailure | undefined }> {
  const { version, upload } = job;
  return convertIntoVersion(
    dependencies,
    { job, version, upload, outputFileName: CUSTOM_ARTIFACT_FILE_NAME },
    candidate,
  );
}
