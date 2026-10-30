import { z } from 'zod/v4';

import type { Job } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';

const IMPORT_INPUT_SCHEMA = z.object({ fileName: z.string(), markdown: z.string() });

// The extraction job of an imported Offre (ADR-0003); a failure throws, which fails the job and
// leaves the Offre as imported
export async function runExtraction(
  { workspace, importSource, locate }: ActionContext,
  job: Job,
): Promise<{ job: Job }> {
  const { offre } = job;
  const { title, ficheDePoste, city, session } = await importSource.extract(
    workspace.offreDirectoryOf(offre),
    workspace.readFicheDePoste(offre),
  );
  // A Fiche de poste without a title keeps the name of its file: nothing is invented
  const lieu = await locate(city);
  const filledOffre = await workspace.fillOffre(offre, { title: title ?? offre.title, ficheDePoste, lieu });
  // Imported by the Candidate, it gets its Recherche whatever the Zone
  await workspace.createJob(filledOffre, 'recherche');
  return { job: await workspace.finishJobWithoutVersion(job, { log: session.log, sessionId: session.sessionId }) };
}

export function createImportActions({ workspace, importSource, findCandidate, locate }: ActionContext) {
  return {
    // The worker reads the fields of the Fiche de poste (ADR-0003); importing the same file again
    // gives back its job, without another Offre nor another job
    async importFicheDePoste(rawInput: unknown): Promise<Job> {
      const candidate = await findCandidate(rawInput);
      const { fileName, markdown } = IMPORT_INPUT_SCHEMA.parse(rawInput);
      const { listedOffre, ficheDePoste } = importSource.list(fileName, markdown);
      const offreList = await workspace.listOffres(candidate.id);
      const importedOffre = offreList.find(({ reference }) => reference === listedOffre.reference);
      if (importedOffre !== undefined) {
        const jobList = await workspace.listJobs(importedOffre);
        const extractionJob = jobList.findLast(({ module }) => module === 'extraction');
        if (extractionJob !== undefined) {
          return extractionJob;
        }
      }
      const offre = await workspace.saveOffre({
        candidateId: candidate.id,
        source: 'import',
        listedOffre,
        ficheDePoste,
        lieu: await locate(null),
        // No Veille detected it, so no Zone holds it; chosen by the Candidate, it gets its Recherche
        // once extracted, whatever the Zone (ADR-0003)
        isInZone: false,
        republicationOf: undefined,
      });
      return workspace.createJob(offre, 'extraction');
    },
  };
}
