import { z } from 'zod/v4';

import {
  PIECE_CONVERSION_SCHEMA,
  PIECE_FILE_NAME_SCHEMA,
  PROFIL_FILE_NAME_SCHEMA,
  type Candidat,
  type PieceConversion,
  type PieceFileName,
  type ProfilJob,
} from '#/domain/index.ts';
import { findConversionFileNameError } from '#/modules/conversion/index.ts';

import type { ActionContext } from './context.ts';

// A CV or a lettre runs to a few hundred kilobytes: more is not a Pièce
const MAX_PIECE_MEGABYTES = 10;
// Every PDF starts with these bytes, whatever its name says
const PDF_SIGNATURE = '%PDF-';

const ETAT_BY_JOB_STATE = { queued: 'en_cours', running: 'en_cours', done: 'pret', failed: 'en_echec' } as const;

const PIECE_NAME_INPUT_SCHEMA = z.object({ fileName: z.string() });
const PIECE_INPUT_SCHEMA = PIECE_NAME_INPUT_SCHEMA.extend({ content: z.instanceof(Uint8Array) });

// The name comes from the front: parsed before anything touches the disk, so it never leads out of
// the folder of the Pièces
function parsePieceFileName(fileName: string): PieceFileName {
  // The front sends an unnamed, empty file when the request carries none
  if (fileName === '') {
    throw new Error('Aucun fichier reçu. Déposer un PDF ou le choisir, puis recommencer.');
  }
  const result = PIECE_FILE_NAME_SCHEMA.safeParse(fileName);
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
  if (content.byteLength > MAX_PIECE_MEGABYTES * 1024 * 1024) {
    throw new Error(
      `« ${fileName} » dépasse ${String(MAX_PIECE_MEGABYTES)} Mo. Réduire le PDF (moins d'images), puis le déposer à nouveau.`,
    );
  }
}

function hasPiece({ workspace }: ActionContext, candidatId: string, fileName: PieceFileName): boolean {
  return workspace.readPieces(candidatId).some((piece) => piece.fileName === fileName);
}

// The worker converts a Pièce into the files of the Profil it names: the CV or a past lettre. A file
// the Profil already has is never overwritten: the job fails and says so.
export async function runConversion(context: ActionContext, job: ProfilJob): Promise<ProfilJob> {
  const { workspace, pieceConversion, findCandidat } = context;
  const { candidatId, piece } = job;
  const candidat = await findCandidat({ candidatId });
  if (!hasPiece(context, candidatId, piece)) {
    throw new Error(
      `« ${piece} » n'est plus dans le Profil de ${candidat.name} : la déposer à nouveau pour la convertir.`,
    );
  }
  const conversion = workspace.startConversion(candidatId, piece);
  const session = await pieceConversion.convert(candidat, { piece, ...conversion });
  const convertedFileList = workspace.readConversionFiles(conversion.outputDirectory);
  if (convertedFileList.length === 0) {
    throw new Error(`La conversion de « ${piece} » n'a écrit aucun fichier Markdown.\n${session.log}`);
  }
  const profilFileList = workspace.readProfilFiles(candidatId);
  const fileList = convertedFileList.map(({ fileName, markdown }) => {
    const nameError = findConversionFileNameError(fileName);
    if (nameError !== undefined) {
      throw new Error(`La conversion de « ${piece} » est refusée : ${nameError}.`);
    }
    const existingFile = profilFileList.find((profilFile) => profilFile.fileName === fileName);
    if (existingFile !== undefined && existingFile.markdown !== markdown) {
      throw new Error(
        `« ${piece} » se convertit en « ${fileName} », que le Profil a déjà : il n'est pas écrasé. Supprimer ou renommer « ${fileName} », puis relancer la conversion.`,
      );
    }
    return { fileName: PROFIL_FILE_NAME_SCHEMA.parse(fileName), markdown };
  });
  for (const { fileName, markdown } of fileList) {
    workspace.saveProfilFile(candidatId, fileName, markdown);
  }
  return workspace.finishProfilJob(job, { log: session.log, sessionId: session.sessionId });
}

export function createPieceActions(context: ActionContext) {
  const { workspace, findCandidat } = context;

  function assertHasPiece(candidat: Candidat, fileName: PieceFileName): void {
    if (!hasPiece(context, candidat.id, fileName)) {
      throw new Error(`Le Profil de ${candidat.name} n'a pas de Pièce « ${fileName} ».`);
    }
  }

  // A conversion still queued reads the Pièce as it will be when it runs: relaunching it again queues
  // nothing more (ADR-0003)
  async function queueConversion(candidat: Candidat, fileName: PieceFileName): Promise<void> {
    const jobList = await workspace.listProfilJobs(candidat.id);
    if (jobList.every((job) => job.state !== 'queued' || job.piece !== fileName)) {
      await workspace.createProfilJob(candidat.id, fileName);
    }
  }

  return {
    // The latest conversion of each Pièce is the one the page shows: an older failure no longer counts
    async listPieces(rawInput: unknown): Promise<PieceConversion[]> {
      const candidat = await findCandidat(rawInput);
      const jobList = await workspace.listProfilJobs(candidat.id);
      return workspace.readPieces(candidat.id).map(({ fileName, savedAt }) => {
        const job = jobList.findLast(({ piece }) => piece === fileName);
        return PIECE_CONVERSION_SCHEMA.parse({
          fileName,
          savedAt,
          conversion:
            job === undefined ? { etat: 'absent', log: '' } : { etat: ETAT_BY_JOB_STATE[job.state], log: job.log },
        });
      });
    },

    // A Pièce of the same name is replaced: the Candidat drops the new version of their CV. The
    // worker then converts it (ADR-0003).
    async savePiece(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const input = PIECE_INPUT_SCHEMA.parse(rawInput);
      const fileName = parsePieceFileName(input.fileName);
      assertIsAcceptedPdf(fileName, input.content);
      workspace.savePiece(candidat.id, fileName, input.content);
      await queueConversion(candidat, fileName);
    },

    async convertPiece(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const fileName = parsePieceFileName(PIECE_NAME_INPUT_SCHEMA.parse(rawInput).fileName);
      assertHasPiece(candidat, fileName);
      await queueConversion(candidat, fileName);
    },

    async deletePiece(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const fileName = parsePieceFileName(PIECE_NAME_INPUT_SCHEMA.parse(rawInput).fileName);
      assertHasPiece(candidat, fileName);
      workspace.deletePiece(candidat.id, fileName);
    },
  };
}
