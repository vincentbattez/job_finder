import { z } from 'zod/v4';

import {
  PROFILE_FILE_NAME_SCHEMA,
  UPLOAD_CONVERSION_SCHEMA,
  UPLOAD_FILE_NAME_SCHEMA,
  type Candidate,
  type ProfileJob,
  type UploadConversion,
  type UploadFileName,
} from '#/domain/index.ts';
import { findConversionFileNameError } from '#/modules/conversion/index.ts';

import type { ActionContext } from './context.ts';

// A CV or a lettre runs to a few hundred kilobytes: more is not an Upload
const MAX_UPLOAD_MEGABYTES = 10;
// Every PDF starts with these bytes, whatever its name says
const PDF_SIGNATURE = '%PDF-';

const ETAT_BY_JOB_STATE = { queued: 'en_cours', running: 'en_cours', done: 'pret', failed: 'en_echec' } as const;

const UPLOAD_NAME_INPUT_SCHEMA = z.object({ fileName: z.string() });
const UPLOAD_INPUT_SCHEMA = UPLOAD_NAME_INPUT_SCHEMA.extend({ content: z.instanceof(Uint8Array) });

// The name comes from the front: parsed before anything touches the disk, so it never leads out of
// the folder of the Uploads
function parseUploadFileName(fileName: string): UploadFileName {
  // The front sends an unnamed, empty file when the request carries none
  if (fileName === '') {
    throw new Error('Aucun fichier reçu. Déposer un PDF ou le choisir, puis recommencer.');
  }
  const result = UPLOAD_FILE_NAME_SCHEMA.safeParse(fileName);
  if (!result.success) {
    throw new Error(
      `« ${fileName} » n'est pas un nom de Pièce : un nom sans dossier, en lettres, chiffres, « - », « _ » ou « . », terminé par « .pdf ».`,
    );
  }
  return result.data;
}

function assertIsAcceptedPdf(fileName: string, content: Uint8Array): void {
  if (new TextDecoder().decode(content.subarray(0, PDF_SIGNATURE.length)) !== PDF_SIGNATURE) {
    throw new Error(`« ${fileName} » n'est pas un PDF. Exporter le document en PDF, puis le déposer à nouveau.`);
  }
  if (content.byteLength > MAX_UPLOAD_MEGABYTES * 1024 * 1024) {
    throw new Error(
      `« ${fileName} » dépasse ${String(MAX_UPLOAD_MEGABYTES)} Mo. Réduire le PDF (moins d'images), puis le déposer à nouveau.`,
    );
  }
}

function hasUpload({ workspace }: ActionContext, candidateId: string, fileName: UploadFileName): boolean {
  return workspace.readUploads(candidateId).some((upload) => upload.fileName === fileName);
}

// The worker converts an Upload into the files of the Profile it names: the CV or a past lettre. A file
// the Profile already has is never overwritten: the job fails and says so.
export async function runConversion(context: ActionContext, job: ProfileJob): Promise<ProfileJob> {
  const { workspace, uploadConversion, findCandidate } = context;
  const { candidateId, upload } = job;
  const candidate = await findCandidate({ candidateId });
  if (!hasUpload(context, candidateId, upload)) {
    throw new Error(
      `« ${upload} » n'est plus dans le Profil de ${candidate.name} : la déposer à nouveau pour la convertir.`,
    );
  }
  const conversion = workspace.startConversion(candidateId, upload);
  const session = await uploadConversion.convert(candidate, { upload, ...conversion });
  const convertedFileList = workspace.readConversionFiles(conversion.outputDirectory);
  if (convertedFileList.length === 0) {
    throw new Error(`La conversion de « ${upload} » n'a écrit aucun fichier Markdown.\n${session.log}`);
  }
  const profileFileList = workspace.readProfileFiles(candidateId);
  const fileList = convertedFileList.map(({ fileName, markdown }) => {
    const nameError = findConversionFileNameError(fileName);
    if (nameError !== undefined) {
      throw new Error(`La conversion de « ${upload} » est refusée : ${nameError}.`);
    }
    const existingFile = profileFileList.find((profileFile) => profileFile.fileName === fileName);
    if (existingFile !== undefined && existingFile.markdown !== markdown) {
      throw new Error(
        `« ${upload} » se convertit en « ${fileName} », que le Profil a déjà : il n'est pas écrasé. Supprimer ou renommer « ${fileName} », puis relancer la conversion.`,
      );
    }
    return { fileName: PROFILE_FILE_NAME_SCHEMA.parse(fileName), markdown };
  });
  for (const { fileName, markdown } of fileList) {
    workspace.saveProfileFile(candidateId, fileName, markdown);
  }
  return workspace.finishProfileJob(job, { log: session.log, sessionId: session.sessionId });
}

export function createUploadActions(context: ActionContext) {
  const { workspace, findCandidate } = context;

  function assertHasUpload(candidate: Candidate, fileName: UploadFileName): void {
    if (!hasUpload(context, candidate.id, fileName)) {
      throw new Error(`Le Profil de ${candidate.name} n'a pas de Pièce « ${fileName} ».`);
    }
  }

  // A conversion still queued reads the Upload as it will be when it runs: relaunching it again queues
  // nothing more (ADR-0003)
  async function queueConversion(candidate: Candidate, fileName: UploadFileName): Promise<void> {
    const jobList = await workspace.listProfileJobs(candidate.id);
    if (jobList.every((job) => job.state !== 'queued' || job.upload !== fileName)) {
      await workspace.createProfileJob(candidate.id, fileName);
    }
  }

  return {
    // The latest conversion of each Upload is the one the page shows: an older failure no longer counts
    async listUploads(rawInput: unknown): Promise<UploadConversion[]> {
      const candidate = await findCandidate(rawInput);
      const jobList = await workspace.listProfileJobs(candidate.id);
      return workspace.readUploads(candidate.id).map(({ fileName, savedAt }) => {
        const job = jobList.findLast(({ upload }) => upload === fileName);
        return UPLOAD_CONVERSION_SCHEMA.parse({
          fileName,
          savedAt,
          conversion:
            job === undefined ? { etat: 'absent', log: '' } : { etat: ETAT_BY_JOB_STATE[job.state], log: job.log },
        });
      });
    },

    // An Upload of the same name is replaced: the Candidate drops the new version of their CV. The
    // worker then converts it (ADR-0003).
    async saveUpload(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const input = UPLOAD_INPUT_SCHEMA.parse(rawInput);
      const fileName = parseUploadFileName(input.fileName);
      assertIsAcceptedPdf(fileName, input.content);
      workspace.saveUpload(candidate.id, fileName, input.content);
      await queueConversion(candidate, fileName);
    },

    async convertUpload(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const fileName = parseUploadFileName(UPLOAD_NAME_INPUT_SCHEMA.parse(rawInput).fileName);
      assertHasUpload(candidate, fileName);
      await queueConversion(candidate, fileName);
    },

    async deleteUpload(rawInput: unknown): Promise<void> {
      const candidate = await findCandidate(rawInput);
      const fileName = parseUploadFileName(UPLOAD_NAME_INPUT_SCHEMA.parse(rawInput).fileName);
      assertHasUpload(candidate, fileName);
      workspace.deleteUpload(candidate.id, fileName);
    },
  };
}
