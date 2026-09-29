import { toSpeakable } from '../speakable';

describe('toSpeakable', () => {
  it('rimuove la formattazione Markdown', () => {
    expect(
      toSpeakable('## Consigli\n- **Dormi** 8 ore\n- Leggi [qui](https://x.y)\n`codice`'),
    ).toBe('Consigli\nDormi 8 ore\nLeggi qui\ncodice');
  });
});
