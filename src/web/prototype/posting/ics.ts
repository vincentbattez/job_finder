// PROTOTYPE · Posting page agent. An Interview as an iCalendar file (RFC 5545), built in the browser:
// its start and duration, its place, the Posting in the summary, the Interviewers in the description,
// and a reminder an hour before. Calendar, Google Agenda and Outlook open it.
import type { IInterview, IPosting } from '../model.ts';

const MINUTE_MS = 60_000;
const LINE_OCTETS = 75;

function escapeText(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll(/\r?\n/gu, '\\n');
}

// 20261102T153000Z
function utcStamp(date: Date): string {
  return date
    .toISOString()
    .replaceAll(/[-:]/gu, '')
    .replace(/\.\d{3}/u, '');
}

// A content line longer than 75 octets continues on lines that start with a space
function fold(line: string): string {
  const encoder = new TextEncoder();
  const partList: string[] = [];
  let current = '';
  let octets = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    const limit = partList.length === 0 ? LINE_OCTETS : LINE_OCTETS - 1;
    if (octets + size > limit) {
      partList.push(current);
      current = '';
      octets = 0;
    }
    current += character;
    octets += size;
  }
  partList.push(current);
  return partList.join('\r\n ');
}

export function icsOf({
  posting,
  interview,
  revisionUrl,
  now = new Date(),
}: {
  posting: Pick<IPosting, 'reference' | 'title' | 'employer'>;
  interview: IInterview;
  revisionUrl: string;
  now?: Date;
}): string {
  const start = new Date(interview.startAt);
  const end = new Date(start.getTime() + interview.durationMinutes * MINUTE_MS);
  const description = [
    `Entretien ${String(interview.number)} pour l’Offre « ${posting.title} »${posting.employer === null ? '' : ` (${posting.employer})`}.`,
    `Interlocuteurs : ${interview.interviewers || '—'}`,
    `Réviser l’Entretien : ${revisionUrl}`,
  ].join('\n');
  const lineList = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Job Finder//Prototype V1//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${posting.reference}-interview-${String(interview.number)}@job-finder`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(`Entretien ${String(interview.number)} · ${posting.title}`)}`,
    `LOCATION:${escapeText(interview.place)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${revisionUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT1H',
    `DESCRIPTION:${escapeText(`Entretien dans une heure · ${posting.title}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lineList.map(fold).join('\r\n')}\r\n`;
}

export function icsFileNameOf(reference: string, number: number): string {
  return `entretien-${String(number)}-${reference}.ics`;
}

// Hands the file to the browser, which saves it or opens it in the calendar
export function downloadIcs(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
