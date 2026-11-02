import type { Version } from '#/domain/index.ts';

// The Versions a Version's run read, among its recorded Inputs
export function readVersionsOf(version: Version | null | undefined) {
  return version?.inputList.flatMap(({ readVersion }) => (readVersion === null ? [] : [readVersion])) ?? [];
}
