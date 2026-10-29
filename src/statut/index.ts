import type { Offre, Statut } from '#/domain/index.ts';
import { STATUT_LABEL_BY_STATUT } from '#/domain/labels.ts';

// A calendar day in France, as « 2026-11-20 », so that two days compare as strings
const FRANCE_DAY_FORMAT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' });

// The last day to apply: the Date limite, else the publication date plus the default delay of the
// config (GLOSSARY.md « Date limite »). The Source gives the Date limite as a day, at midnight UTC.
function findLastDay(
  { dateLimite, publishedAt }: Pick<Offre, 'dateLimite' | 'publishedAt'>,
  defaultDelayMonths: number,
): string | undefined {
  if (dateLimite !== null) {
    return dateLimite.toISOString().slice(0, 'AAAA-MM-JJ'.length);
  }
  if (publishedAt === null) {
    return undefined;
  }
  const lastDay = new Date(publishedAt);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + defaultDelayMonths);
  return FRANCE_DAY_FORMAT.format(lastDay);
}

// Expirée is computed, never stored, whatever the statut (spec « Statut »). An Offre without any
// date never expires.
export function isExpiree(
  offre: Pick<Offre, 'dateLimite' | 'publishedAt'>,
  now: Date,
  defaultDelayMonths: number,
): boolean {
  const lastDay = findLastDay(offre, defaultDelayMonths);
  return lastDay !== undefined && FRANCE_DAY_FORMAT.format(now) > lastDay;
}

// Postulée once, even if Archivée since: the Candidat sent its Lettre retenue. An Offre Postulée
// before postuleeAt existed has none.
export function hasBeenPostulee({ status, postuleeAt }: Pick<Offre, 'status' | 'postuleeAt'>): boolean {
  return status === 'postulee' || postuleeAt !== null;
}

// When an Offre moving to the statut was first Postulée: its Lettre retenue, the one sent, stays
// frozen from then on
export function findPostuleeAt(offre: Pick<Offre, 'status' | 'postuleeAt'>, statut: Statut, now: Date): Date | null {
  return offre.postuleeAt ?? (statut === 'postulee' || hasBeenPostulee(offre) ? now : null);
}

// The statuts an Offre can move to. Postulée is never undone, since the Lettre retenue was sent: a
// Postulée Offre can be Archivée, and comes back from Archivée as Postulée, never À traiter.
export function listNextStatuts(offre: Pick<Offre, 'status' | 'postuleeAt'>): Statut[] {
  switch (offre.status) {
    case 'a_traiter': {
      return ['postulee', 'archivee'];
    }
    case 'postulee': {
      return ['archivee'];
    }
    case 'archivee': {
      return [hasBeenPostulee(offre) ? 'postulee' : 'a_traiter'];
    }
  }
}

// Moving to the statut it already has changes nothing
export function assertStatutChange(offre: Pick<Offre, 'reference' | 'status' | 'postuleeAt'>, statut: Statut): void {
  const nextStatutList = listNextStatuts(offre);
  if (statut === offre.status || nextStatutList.includes(statut)) {
    return;
  }
  const nextLabelList = nextStatutList.map((nextStatut) => STATUT_LABEL_BY_STATUT[nextStatut]);
  const reason = hasBeenPostulee(offre) ? ", Postulée ne s'annulant jamais : sa Lettre retenue est celle envoyée" : '';
  throw new Error(
    `L'Offre ${offre.reference} est ${STATUT_LABEL_BY_STATUT[offre.status]} : elle ne peut passer qu'en ${nextLabelList.join(' ou ')}${reason}.`,
  );
}

// The Lettre retenue of an Offre once Postulée is the one that was sent: it can no longer be
// edited, regenerated or swapped for another Version, even once the Offre is Archivée. Every
// action that would change it calls this first.
export function assertLettreModifiable(offre: Pick<Offre, 'reference' | 'status' | 'postuleeAt'>): void {
  if (hasBeenPostulee(offre)) {
    throw new Error(
      `L'Offre ${offre.reference} a été Postulée : sa Lettre retenue est figée telle qu'envoyée. Elle ne se modifie plus, ne se régénère plus et ne se remplace plus par une autre Version.`,
    );
  }
}
