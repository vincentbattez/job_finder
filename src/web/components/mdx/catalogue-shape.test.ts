import { describe, expect, it } from 'vitest';

import { CATALOGUE_SHAPE_LIST } from './catalogue-shape.ts';
import { MDX_CATALOGUE } from './catalogue.tsx';

// Adding a component to the catalogue means its rendering and its MDX editor descriptor (ADR-0020)
describe('the catalogue as the MDX editor edits it', () => {
  it('describes every component of the catalogue, and nothing else', () => {
    const componentNameList = Object.keys(MDX_CATALOGUE).filter((name) => /^[A-Z]/u.test(name));

    expect(new Set(CATALOGUE_SHAPE_LIST.map(({ name }) => name))).toEqual(new Set(componentNameList));
  });
});
