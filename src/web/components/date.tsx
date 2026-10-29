const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeZone: 'Europe/Paris' });

export function DateText({ date }: Readonly<{ date: Date | null }>) {
  return date === null ? (
    <span className="missing">Non précisée</span>
  ) : (
    <time dateTime={date.toISOString()}>{DATE_FORMAT.format(date)}</time>
  );
}
