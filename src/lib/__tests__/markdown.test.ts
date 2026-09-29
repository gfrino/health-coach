import { parseInline, parseMarkdown } from '../markdown';

describe('parseMarkdown', () => {
  it('riconosce titoli, paragrafi, elenchi e codice', () => {
    const blocks = parseMarkdown(
      '# Titolo\n\nRiga uno\nriga due\n\n- a\n- **b**\n\n1. uno\n2. due\n\n```\ncodice\n```\n> nota',
    );
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'list',
      'code',
      'quote',
    ]);
    expect(blocks[1]).toEqual({
      type: 'paragraph',
      inline: [{ type: 'text', text: 'Riga uno riga due' }],
    });
    expect(blocks[2]).toMatchObject({
      type: 'list',
      ordered: false,
      items: [[{ text: 'a' }], [{ type: 'bold' }]],
    });
    expect(blocks[3]).toMatchObject({ ordered: true });
    expect(blocks[4]).toEqual({ type: 'code', text: 'codice' });
  });
});

describe('parseInline', () => {
  it('grassetto, corsivo, codice e link', () => {
    expect(parseInline('**forte** e *leggero*, `x` [qui](https://example.com)')).toEqual([
      { type: 'bold', children: [{ type: 'text', text: 'forte' }] },
      { type: 'text', text: ' e ' },
      { type: 'italic', children: [{ type: 'text', text: 'leggero' }] },
      { type: 'text', text: ', ' },
      { type: 'code', text: 'x' },
      { type: 'text', text: ' ' },
      { type: 'link', url: 'https://example.com', children: [{ type: 'text', text: 'qui' }] },
    ]);
  });

  it('non tratta come corsivo asterischi isolati o link non http', () => {
    expect(parseInline('3 * 4 = 12')).toEqual([{ type: 'text', text: '3 * 4 = 12' }]);
    expect(parseInline('[x](javascript:alert(1))')[0]).toEqual({
      type: 'text',
      text: '[x](javascript:alert(1))',
    });
  });
});
