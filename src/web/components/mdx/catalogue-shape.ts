// The shape of each component of the catalogue, as the MDX editor edits it: block or inline, and the string
// attributes it takes (ADR-0020: each component has its rendering, its editor descriptor and its line in the
// Fixed Part). The parents are those the editor inserts, with an example child to fill in.
export interface ICatalogueShape {
  name: string;
  kind: 'flow' | 'text';
  attributeList: string[];
  isInsertable: boolean;
}

export const CATALOGUE_SHAPE_LIST: ICatalogueShape[] = [
  { name: 'Callout', kind: 'flow', attributeList: ['type', 'title'], isInsertable: true },
  { name: 'Tabs', kind: 'flow', attributeList: [], isInsertable: true },
  { name: 'Tab', kind: 'flow', attributeList: ['title'], isInsertable: false },
  { name: 'Accordion', kind: 'flow', attributeList: [], isInsertable: true },
  { name: 'AccordionItem', kind: 'flow', attributeList: ['title'], isInsertable: false },
  { name: 'Cards', kind: 'flow', attributeList: [], isInsertable: true },
  { name: 'Card', kind: 'flow', attributeList: ['title', 'description'], isInsertable: false },
  { name: 'Badge', kind: 'text', attributeList: ['tone'], isInsertable: false },
  { name: 'Table', kind: 'flow', attributeList: ['caption'], isInsertable: false },
  { name: 'Steps', kind: 'flow', attributeList: [], isInsertable: true },
  { name: 'Step', kind: 'flow', attributeList: ['title'], isInsertable: false },
  { name: 'Timeline', kind: 'flow', attributeList: [], isInsertable: true },
  { name: 'Event', kind: 'flow', attributeList: ['date', 'title'], isInsertable: false },
  { name: 'Quote', kind: 'flow', attributeList: ['author', 'source'], isInsertable: true },
  { name: 'Checklist', kind: 'flow', attributeList: ['title'], isInsertable: true },
  { name: 'Diagram', kind: 'flow', attributeList: ['title'], isInsertable: true },
];
