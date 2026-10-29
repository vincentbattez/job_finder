import type { Offre } from '#/domain/index.ts';

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

// The Lettre retenue of a Postulée Offre is the one that was sent: it can no longer be edited,
// regenerated or swapped for another Version (spec « Versions »). Every action that would change it
// calls this first.
export function assertLettreModifiable({ reference, status }: Pick<Offre, 'reference' | 'status'>): void {
  if (status === 'postulee') {
    throw new Error(
      `L'Offre ${reference} est Postulée : sa Lettre retenue est figée telle qu'envoyée. Elle ne se modifie plus, ne se régénère plus et ne se remplace plus par une autre Version.`,
    );
  }
}
