import { MARK_END, MARK_START } from '#/domain/substitution.ts';

// The values a marked Fixed Part highlights, in order
export function markedValuesOf(markedFixedPart = ''): string[] {
  return markedFixedPart
    .matchAll(new RegExp(`${MARK_START}(.*?)${MARK_END}`, 'gu'))
    .map(([, value = '']) => value)
    .toArray();
}
