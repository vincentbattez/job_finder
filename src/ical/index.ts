import { parisDateTimeOf } from '#/domain/paris-time.ts';

// One event of a calendar, its texts as the Candidate reads them
export interface ICalendarEvent {
  // Stable for the same appointment, so that a calendar updates the event a new file brings
  uid: string;
  // Grows at each edit: a calendar replaces the event only with a higher one
  sequence: number;
  startAt: Date;
  endAt: Date;
  summary: string;
  location: string;
  description: string;
  url: string;
  // When the file was produced
  stampedAt: Date;
}

// RFC 5545 caps a line at 75 octets: the rest goes on lines starting with a space
const LINE_OCTET_LIMIT = 75;

const ENCODER = new TextEncoder();

// The Candidates live in France: an event is dated in Paris time, with the rules of its clock changes,
// so that a calendar elsewhere still shows the right hour
const PARIS_TIMEZONE_LINE_LIST = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Paris',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

// « 20261119T140000 », the time Paris reads
function parisStampOf(date: Date): string {
  return `${parisDateTimeOf(date).replaceAll(/[-:]/g, '')}00`;
}

// « 20261031T021500Z »
function utcStampOf(date: Date): string {
  return `${date.toISOString().slice(0, 'YYYY-MM-DDTHH:mm:ss'.length).replaceAll(/[-:]/g, '')}Z`;
}

// A text value, its separators and its line breaks escaped (RFC 5545, 3.3.11)
function escapeText(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll(';', String.raw`\;`)
    .replaceAll(',', String.raw`\,`)
    .replaceAll(/\r?\n/g, String.raw`\n`);
}

// Cut between characters, never inside one: a continuation line counts its leading space
function foldLine(line: string): string {
  const partList: string[] = [];
  let part = '';
  let octetCount = 0;
  for (const character of line) {
    const characterOctetCount = ENCODER.encode(character).length;
    const limit = partList.length === 0 ? LINE_OCTET_LIMIT : LINE_OCTET_LIMIT - 1;
    if (octetCount + characterOctetCount > limit) {
      partList.push(part);
      part = '';
      octetCount = 0;
    }
    part += character;
    octetCount += characterOctetCount;
  }
  partList.push(part);
  return partList.join('\r\n ');
}

// An iCal file of one event, written by hand since the format is simple (spec #45): a day-before
// alarm, which Apple Calendar honors and Google Calendar replaces with its own reminders
export function formatCalendar(event: ICalendarEvent): string {
  const lineList = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Job Finder//Interview//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...PARIS_TIMEZONE_LINE_LIST,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `SEQUENCE:${String(event.sequence)}`,
    `DTSTAMP:${utcStampOf(event.stampedAt)}`,
    `DTSTART;TZID=Europe/Paris:${parisStampOf(event.startAt)}`,
    `DTEND;TZID=Europe/Paris:${parisStampOf(event.endAt)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `LOCATION:${escapeText(event.location)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `URL:${event.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.summary)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lineList.map((line) => foldLine(line)).join('\r\n')}\r\n`;
}
