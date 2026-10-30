import { useCatalogue } from '#/web/catalogue.ts';

export function DateText({ date }: Readonly<{ date: Date | null }>) {
  const { common } = useCatalogue();
  return date === null ? (
    <span className="missing">{common.missingDate}</span>
  ) : (
    <time dateTime={date.toISOString()}>{common.formatDate(date)}</time>
  );
}
