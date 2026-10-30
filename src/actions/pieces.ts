import { z } from 'zod/v4';

import { PIECE_FILE_NAME_SCHEMA, type Candidat, type Piece, type PieceFileName } from '#/domain/index.ts';

import type { ActionContext } from './context.ts';

// A CV or a lettre runs to a few hundred kilobytes: more is not a Pièce
const MAX_PIECE_MEGABYTES = 10;
// Every PDF starts with these bytes, whatever its name says
const PDF_SIGNATURE = '%PDF-';

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

export function createPieceActions({ workspace, findCandidat }: ActionContext) {
  function assertHasPiece(candidat: Candidat, fileName: PieceFileName): void {
    if (workspace.readPieces(candidat.id).every((piece) => piece.fileName !== fileName)) {
      throw new Error(`Le Profil de ${candidat.name} n'a pas de Pièce « ${fileName} ».`);
    }
  }

  return {
    async listPieces(rawInput: unknown): Promise<Piece[]> {
      const candidat = await findCandidat(rawInput);
      return workspace.readPieces(candidat.id);
    },

    // A Pièce of the same name is replaced: the Candidat drops the new version of their CV
    async savePiece(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const input = PIECE_INPUT_SCHEMA.parse(rawInput);
      const fileName = parsePieceFileName(input.fileName);
      assertIsAcceptedPdf(fileName, input.content);
      workspace.savePiece(candidat.id, fileName, input.content);
    },

    async deletePiece(rawInput: unknown): Promise<void> {
      const candidat = await findCandidat(rawInput);
      const fileName = parsePieceFileName(PIECE_NAME_INPUT_SCHEMA.parse(rawInput).fileName);
      assertHasPiece(candidat, fileName);
      workspace.deletePiece(candidat.id, fileName);
    },
  };
}
