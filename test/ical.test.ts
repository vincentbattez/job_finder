import { beforeAll, describe, expect, it } from 'vitest';

import type { Actions } from '#/actions/index.ts';

import { detectPostings } from './data-directory.ts';

// The address the Candidate opened Job Finder through, here over the VPN
const ORIGIN = 'https://10.8.0.1:5180';

const PLACE = 'Tribunal judiciaire, room 3; Béthune';

// A long line of an iCal file is folded at 75 octets, its next part starting with a space (RFC 5545)
function unfold(text: string): string {
  return text.replaceAll('\r\n ', '');
}

// The value of a property of the event, its parameters and its text escapes left as written
function valueOf(text: string, name: string): string | undefined {
  const lineList = unfold(text).split('\r\n');
  const line = lineList
    .slice(lineList.indexOf('BEGIN:VEVENT'))
    .find((entry) => entry.startsWith(`${name}:`) || entry.startsWith(`${name};`));
  return line?.slice(line.indexOf(':') + 1);
}

// Each test works on its own Posting, so they share one Detection on the responses recorded on 2026-10-29
describe('the iCal file of an Interview', () => {
  let actions: Actions;

  beforeAll(async () => {
    ({ actions } = await detectPostings());
  });

  // An Application's first Interview, on 19 November 2026 at 14:00 in Paris
  async function addInterview(reference: string, other: Record<string, unknown> = {}) {
    await actions.changeStatus({ reference, status: 'applied' });
    await actions.addInterview({
      reference,
      start: '2026-11-19T14:00',
      place: PLACE,
      interviewers: 'Mme Durand',
      ...other,
    });
  }

  it('is a calendar event titled after the Posting and its employer, at the place of the Interview', async () => {
    await addInterview('2026-2445609');

    const { fileName, text } = await actions.readIcalFile({ reference: '2026-2445609', number: 1, origin: ORIGIN });

    expect(fileName).toBe('interview-2026-2445609-1.ics');
    expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(text.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(valueOf(text, 'SUMMARY')).toBe(
      "Entretien · Attaché de justice affecté auprès des magistrats du siège - Service de l'instruction - TJ BETHUNE · Cour d'Appel de Douai",
    );
    expect(valueOf(text, 'LOCATION')).toBe(String.raw`Tribunal judiciaire\, room 3\; Béthune`);
  });

  it('starts and ends in Europe/Paris, summer time included', async () => {
    await addInterview('2026-2445600');
    await actions.addInterview({
      reference: '2026-2445600',
      start: '2026-07-10T10:00',
      durationMinutes: 90,
      place: PLACE,
      interviewers: '',
    });

    const winter = await actions.readIcalFile({ reference: '2026-2445600', number: 1, origin: ORIGIN });
    const summer = await actions.readIcalFile({ reference: '2026-2445600', number: 2, origin: ORIGIN });

    expect([valueOf(winter.text, 'DTSTART'), valueOf(winter.text, 'DTEND')]).toEqual([
      '20261119T140000',
      '20261119T150000',
    ]);
    expect([valueOf(summer.text, 'DTSTART'), valueOf(summer.text, 'DTEND')]).toEqual([
      '20260710T100000',
      '20260710T113000',
    ]);
    expect(unfold(winter.text)).toContain('DTSTART;TZID=Europe/Paris:20261119T140000\r\n');
    expect(unfold(winter.text)).toContain('BEGIN:VTIMEZONE\r\nTZID:Europe/Paris\r\n');
  });

  it('rings a day before the Interview', async () => {
    await addInterview('2026-2445183');

    const { text } = await actions.readIcalFile({ reference: '2026-2445183', number: 1, origin: ORIGIN });

    expect(unfold(text)).toMatch(
      /BEGIN:VALARM\r\nACTION:DISPLAY\r\n(?:.*\r\n)*?TRIGGER:-P1D\r\n(?:.*\r\n)*?END:VALARM/,
    );
  });

  it('describes the links to the official ad and to the Posting page and its sections, on the origin passed', async () => {
    await addInterview('2026-2350473');

    const { text } = await actions.readIcalFile({
      reference: '2026-2350473',
      number: 1,
      origin: 'https://job-finder.example.org/somewhere',
    });

    expect(valueOf(text, 'DESCRIPTION')?.split(String.raw`\n`)).toEqual([
      'Annonce officielle : https://choisirleservicepublic.gouv.fr/offre-emploi/2026-2350473/?tracking=1&idOrigine=502',
      'Page Job Finder : https://job-finder.example.org/postings/2026-2350473',
      'Recherche : https://job-finder.example.org/postings/2026-2350473?tab=research',
      'Lettre de motivation : https://job-finder.example.org/postings/2026-2350473?tab=letter',
      'Fiche d’entretien : https://job-finder.example.org/postings/2026-2350473?tab=interviews&interview=1&doc=interview_brief',
      'Entretien 1 : https://job-finder.example.org/postings/2026-2350473?tab=interviews&interview=1',
    ]);
    expect(valueOf(text, 'URL')).toBe('https://job-finder.example.org/postings/2026-2350473');
  });

  it('leaves the official ad out of the description of an imported Posting, which has none', async () => {
    const { posting } = await actions.importJobDescription({
      candidateId: 'lea',
      fileName: 'greffier-lille.md',
      markdown: '# Greffier\n\nTribunal judiciaire de Lille.\n',
    });
    await addInterview(posting.reference);

    const { text } = await actions.readIcalFile({ reference: posting.reference, number: 1, origin: ORIGIN });

    expect(valueOf(text, 'DESCRIPTION')?.split(String.raw`\n`)[0]).toBe(
      `Page Job Finder : ${ORIGIN}/postings/${posting.reference}`,
    );
  });

  it('keeps its UID across edits and raises its SEQUENCE at each one, so a calendar updates the event', async () => {
    await addInterview('2026-2360411');
    await actions.addInterview({ reference: '2026-2360411', start: '2026-11-26T14:00', place: '', interviewers: '' });
    const first = await actions.readIcalFile({ reference: '2026-2360411', number: 1, origin: ORIGIN });

    await actions.editInterview({ reference: '2026-2360411', number: 1, place: 'Visioconférence' });
    await actions.editInterview({ reference: '2026-2360411', number: 1, durationMinutes: 45 });
    const edited = await actions.readIcalFile({ reference: '2026-2360411', number: 1, origin: ORIGIN });
    const other = await actions.readIcalFile({ reference: '2026-2360411', number: 2, origin: ORIGIN });

    expect(valueOf(edited.text, 'UID')).toBe(valueOf(first.text, 'UID'));
    expect(valueOf(other.text, 'UID')).not.toBe(valueOf(first.text, 'UID'));
    expect([valueOf(first.text, 'SEQUENCE'), valueOf(edited.text, 'SEQUENCE')]).toEqual(['0', '2']);
    expect(valueOf(edited.text, 'LOCATION')).toBe('Visioconférence');
  });

  it('folds its lines at 75 octets', async () => {
    await addInterview('2026-2231960', { place: 'É'.repeat(80) });

    const { text } = await actions.readIcalFile({ reference: '2026-2231960', number: 1, origin: ORIGIN });

    const lengthList = text.split('\r\n').map((line) => new TextEncoder().encode(line).length);
    expect(Math.max(...lengthList)).toBeLessThanOrEqual(75);
    expect(valueOf(text, 'LOCATION')).toBe('É'.repeat(80));
  });

  it('is refused for an Interview the Posting does not have', async () => {
    await expect(actions.readIcalFile({ reference: '2026-2199164', number: 3, origin: ORIGIN })).rejects.toMatchObject({
      code: 'unknown_interview',
    });
  });
});
