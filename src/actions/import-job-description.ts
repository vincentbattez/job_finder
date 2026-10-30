import { z } from 'zod/v4';

import type { Job } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';

const IMPORT_INPUT_SCHEMA = z.object({ fileName: z.string(), markdown: z.string() });

// The extraction job of an imported Posting (ADR-0003); a failure throws, which fails the job and
// leaves the Posting as imported
export async function runExtraction(
  { workspace, importSource, findLocale, locate }: ActionContext,
  job: Job,
): Promise<{ job: Job }> {
  const { posting } = job;
  const locale = await findLocale(posting.candidateId);
  const { title, jobDescription, city, session } = await importSource.extract(
    workspace.postingDirectoryOf(posting),
    workspace.readJobDescription(posting, locale),
    locale,
  );
  // A Job Description without a title keeps the name of its file: nothing is invented
  const location = await locate(city, locale);
  const filledPosting = await workspace.fillPosting(
    posting,
    { title: title ?? posting.title, jobDescription, location },
    locale,
  );
  // Imported by the Candidate, it gets its Research whatever the Zone
  await workspace.createJob(filledPosting, 'research');
  return { job: await workspace.finishJobWithoutVersion(job, { log: session.log, sessionId: session.sessionId }) };
}

export function createImportActions({ workspace, importSource, findCandidate, locate }: ActionContext) {
  return {
    // The worker reads the fields of the Job Description (ADR-0003); importing the same file again
    // gives back its job, without another Posting nor another job, unless that job failed: giving it
    // back would announce an extraction queued while nothing runs, so it is queued again
    async importJobDescription(rawInput: unknown): Promise<Job> {
      const candidate = await findCandidate(rawInput);
      const { fileName, markdown } = IMPORT_INPUT_SCHEMA.parse(rawInput);
      const { listedPosting, jobDescription } = importSource.list(fileName, markdown);
      const postingList = await workspace.listPostings(candidate.id);
      const importedPosting = postingList.find(({ reference }) => reference === listedPosting.reference);
      if (importedPosting !== undefined) {
        const jobList = await workspace.listJobs(importedPosting);
        const extractionJob = jobList.findLast(({ module }) => module === 'extraction');
        if (extractionJob?.state === 'failed') {
          return workspace.createJob(importedPosting, 'extraction');
        }
        if (extractionJob !== undefined) {
          return extractionJob;
        }
      }
      const posting = await workspace.savePosting({
        candidateId: candidate.id,
        source: 'import',
        listedPosting,
        jobDescription,
        location: await locate(null, candidate.locale),
        // No Watch detected it, so no Zone holds it; chosen by the Candidate, it gets its Research
        // once extracted, whatever the Zone (ADR-0003)
        isInZone: false,
        repostOf: undefined,
      });
      return workspace.createJob(posting, 'extraction');
    },
  };
}
