import type { Statut } from './index.ts';

// How the CLI, the front and the messages name each statut (GLOSSARY.md)
export const STATUT_LABEL_BY_STATUT: Record<Statut, string> = {
  a_traiter: 'À traiter',
  postulee: 'Postulée',
  archivee: 'Archivée',
};
