import { describe, expect, it } from 'vitest';

import { compareBlocks, splitBlocks } from './blocks.ts';

const CALLOUT = '<Callout type="tip" title="Bon à savoir">\n\nPremier paragraphe.\n\nSecond paragraphe.\n\n</Callout>';
const FENCE = '```mermaid\nflowchart LR\n\n  A --> B\n```';

describe('the blocks of an Artifact text', () => {
  it('cuts at the blank lines of the top level', () => {
    expect(splitBlocks('# Titre\n\nUn paragraphe\nsur deux lignes.\n\n\n- un\n- deux\n')).toEqual([
      '# Titre',
      'Un paragraphe\nsur deux lignes.',
      '- un\n- deux',
    ]);
  });

  // Blocks are cut at the MDX top level, never inside a fence or a component (spec #125)
  it('keeps a component and a fence whole, blank lines included', () => {
    expect(splitBlocks(`Avant.\n\n${CALLOUT}\n\n${FENCE}\n\nAprès.`)).toEqual(['Avant.', CALLOUT, FENCE, 'Après.']);
  });

  it('keeps nested components whole', () => {
    const tabs = '<Tabs>\n<Tab title="A">\n\nUn.\n\n</Tab>\n<Tab title="B">\n\nDeux.\n\n</Tab>\n</Tabs>';
    expect(splitBlocks(`${tabs}\n\nFin.`)).toEqual([tabs, 'Fin.']);
  });

  it('takes a self-closing component and an inline one as ordinary lines', () => {
    expect(splitBlocks('<Badge tone="info">Nouveau</Badge> en tête.\n\n<Diagram title="x" />\n\nFin.')).toEqual([
      '<Badge tone="info">Nouveau</Badge> en tête.',
      '<Diagram title="x" />',
      'Fin.',
    ]);
  });
});

describe('comparing a text with its Original', () => {
  it('aligns each change with its counterpart and keeps the unchanged runs between them', () => {
    const original = 'Un.\n\nDeux.\n\nTrois.\n\nQuatre.';
    const text = 'Un.\n\nDeux, corrigé.\n\nTrois.\n\nQuatre.\n\nCinq.';

    expect(compareBlocks(original, text)).toEqual([
      { kind: 'same', blockList: ['Un.'] },
      { kind: 'change', originalList: ['Deux.'], textList: ['Deux, corrigé.'] },
      { kind: 'same', blockList: ['Trois.', 'Quatre.'] },
      { kind: 'change', originalList: [], textList: ['Cinq.'] },
    ]);
  });

  it('finds nothing to compare in a text left as the AI wrote it', () => {
    expect(compareBlocks('Un.\n\nDeux.', 'Un.\n\nDeux.\n')).toEqual([{ kind: 'same', blockList: ['Un.', 'Deux.'] }]);
  });
});
