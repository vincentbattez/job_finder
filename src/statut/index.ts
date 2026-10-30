import type { Offre, Statut } from '#/domain/index.ts';
import { STATUT_LABEL_BY_STATUT } from '#/domain/labels.ts';

// What the statut rules read of an Offre
type OffreStatut = Pick<Offre, 'reference' | 'statut' | 'postuleeAt'>;

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

// Computed, never stored, since it depends on the day; an Offre without any date never expires
export function isExpiree(
  offre: Pick<Offre, 'dateLimite' | 'publishedAt'>,
  now: Date,
  defaultDelayMonths: number,
): boolean {
  const lastDay = findLastDay(offre, defaultDelayMonths);
  return lastDay !== undefined && FRANCE_DAY_FORMAT.format(now) > lastDay;
}

// Postulée once, even if Archivée since: the Candidate sent its Lettre retenue. An Offre Postulée
// before postuleeAt existed has none.
export function hasBeenPostulee({ statut, postuleeAt }: Pick<Offre, 'statut' | 'postuleeAt'>): boolean {
  return statut === 'postulee' || postuleeAt !== null;
}

// When an Offre moving to the statut was first Postulée: its Lettre retenue, the one sent, stays
// frozen from then on
export function findPostuleeAt(offre: Pick<Offre, 'statut' | 'postuleeAt'>, statut: Statut, now: Date): Date | null {
  return offre.postuleeAt ?? (statut === 'postulee' || hasBeenPostulee(offre) ? now : null);
}

// The statuts an Offre can move to. Postulée is never undone, since the Lettre retenue was sent: a
// Postulée Offre can be Archivée, and comes back from Archivée as Postulée, never À traiter.
export function listNextStatuts(offre: Pick<Offre, 'statut' | 'postuleeAt'>): Statut[] {
  switch (offre.statut) {
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
export function assertStatutChange(offre: OffreStatut, statut: Statut): void {
  const nextStatutList = listNextStatuts(offre);
  if (statut === offre.statut || nextStatutList.includes(statut)) {
    return;
  }
  const nextLabelList = nextStatutList.map((nextStatut) => STATUT_LABEL_BY_STATUT[nextStatut]);
  const reason = hasBeenPostulee(offre) ? ", Postulée ne s'annulant jamais : sa Lettre retenue est celle envoyée" : '';
  throw new Error(
    `L'Offre ${offre.reference} est ${STATUT_LABEL_BY_STATUT[offre.statut]} : elle ne peut passer qu'en ${nextLabelList.join(' ou ')}${reason}.`,
  );
}

// Once the Offre was Postulée, the Lettre retenue is the one sent, even once the Offre is Archivée
export function findLettreFreeze(offre: OffreStatut): string | undefined {
  return hasBeenPostulee(offre)
    ? `L'Offre ${offre.reference} a été Postulée : sa Lettre retenue est figée telle qu'envoyée. Elle ne se modifie plus, ne se régénère plus et ne se remplace plus par une autre Version.`
    : undefined;
}

// Every action that would change the Lettre retenue calls this first
export function assertLettreModifiable(offre: OffreStatut): void {
  const freeze = findLettreFreeze(offre);
  if (freeze !== undefined) {
    throw new Error(freeze);
  }
}
