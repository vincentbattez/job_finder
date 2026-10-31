// The Candidates live in France: the start of an Interview is typed and read in Paris time, whatever the
// locale, like a date (catalogue « date »). Without zod, so the front's bundle may import it.
const PARIS_FORMAT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const MINUTE_LENGTH = 'YYYY-MM-DDTHH:mm'.length;

// The instant as Paris reads it, « 2026-11-19T14:00:05 »
function parisTextOf(date: Date): string {
  return PARIS_FORMAT.format(date).replace(' ', 'T');
}

// « 2026-11-19T14:00 », as a datetime-local field holds it
export function parisDateTimeOf(date: Date): string {
  return parisTextOf(date).slice(0, MINUTE_LENGTH);
}

// How far Paris is ahead of UTC at that instant
function parisOffsetMsAt(date: Date): number {
  return new Date(`${parisTextOf(date)}Z`).getTime() - date.getTime();
}

// The instant of a Paris date and time, « 2026-11-19T14:00 »: the offset is read again once applied,
// since it differs on the day the clocks change
export function dateOfParisDateTime(dateTime: string): Date {
  const asUtc = new Date(`${dateTime}Z`);
  const firstGuess = new Date(asUtc.getTime() - parisOffsetMsAt(asUtc));
  return new Date(asUtc.getTime() - parisOffsetMsAt(firstGuess));
}
