import type { SourceModule, Watch } from '#/domain/index.ts';
import type { ISource } from '#/source/index.ts';

// How the Candidate tells their Watches apart, for the Detection and the Watches page alike
export function watchNamesOf(sourceList: ISource[]) {
  function descriptionOf({ source }: Watch): SourceModule | undefined {
    return sourceList.find(({ description: { id } }) => id === source)?.description;
  }

  function sourceNameOf(watch: Watch): string {
    return descriptionOf(watch)?.name ?? watch.source;
  }

  // Its first text Parameter, such as the searched title, in the order its Source declares them,
  // never its identifier (#63)
  function labelOf(watch: Watch): string {
    const { source, parameters } = watch;
    const description = descriptionOf(watch);
    const label = description?.parameterList
      .map(({ name }) => parameters[name])
      .find((value): value is string => typeof value === 'string' && value !== '');
    return label ?? description?.name ?? source;
  }

  return { sourceNameOf, labelOf };
}
