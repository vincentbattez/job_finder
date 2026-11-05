import { z } from 'zod/v4';

import { IMPORT_SOURCE_ID, type Job } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';
import { createTolerantLocator } from './locator.ts';

const IMPORT_INPUT_SCHEMA = z.object({ fileName: z.string(), markdown: z.string() });

// The extraction job of an imported Posting (ADR-0003); a failure throws, which fails the job and
// leaves the Posting as imported
export async function runExtraction(
  { workspace, artifacts, importSource, findLocale, locate }: ActionContext,
  job: Job,
): Promise<{ job: Job }> {
  const { posting } = job;
  const locale = await findLocale(posting.candidateId);
  const { title, jobDescription, city, session } = await importSource.extract(
    workspace.postingDirectoryOf(posting),
    workspace.readJobDescription(posting, locale),
    locale,
  );
  // A Job Description without a title keeps the name of its file: nothing is invented. API Géo down
  // leaves it off the map, as a Detection does, until the next Detection locates it
  const locator = createTolerantLocator(locate);
  const location = await locator.locate(city, locale);
  const filledPosting = await workspace.fillPosting(
    posting,
    { title: title ?? posting.title, jobDescription, location },
    locale,
  );
  // Imported by the Candidate, who decided to pursue it, it gets its Research (ADR-0018)
  const research = await artifacts.find({ posting: filledPosting, artifact: 'research' });
  await research.queueRun({ isAutomatic: true });
  const log = [session.log, locator.failureFor(locale)].filter((line) => line !== null && line !== '').join('\n');
  return { job: await workspace.finishJobWithoutVersion(job, { log, sessionId: session.sessionId }) };
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
        source: IMPORT_SOURCE_ID,
        listedPosting,
        jobDescription,
        location: await locate(null, candidate.locale),
        // Importing it is already the decision to pursue it: it skips New (ADR-0018)
        status: 'to_apply',
        repostOf: undefined,
      });
      return workspace.createJob(posting, 'extraction');
    },
  };
}
